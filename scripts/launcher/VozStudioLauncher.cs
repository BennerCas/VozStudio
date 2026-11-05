// VozStudioLauncher.cs
// Lanzador nativo Win64 GUI (Subsystem:WINDOWS - cero consolas) para VozStudio Omni-ES.
// Levanta enlaces de modelos, servidor backend silencioso (pythonw) y ventana independiente
// en modo App-Kiosko ajustada al WorkingArea de Windows (solo barra de tareas de Windows visible,
// cero barras de navegador, cero extensiones, cero anuncios ni ventanas emergentes).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace VozStudioLauncher
{
    internal static class NativeMethods
    {
        [DllImport("user32.dll")]
        internal static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        internal static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        internal static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

        [DllImport("dwmapi.dll")]
        internal static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        internal const int SW_SHOWMAXIMIZED = 3;
        internal const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        internal const int DWMWA_BORDER_COLOR = 34;
        internal const int DWMWA_CAPTION_COLOR = 35;
        internal const int DWMWA_TEXT_COLOR = 36;
    }

    internal static class Program
    {
        private const string DefaultHost = "127.0.0.1";
        private const int DefaultPort = 8880;
        private const string MutexName = "Local\\VozStudioOmniES_SingleLauncherMutex";

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                NativeMethods.SetProcessDPIAware();
            }
            catch
            {
                // Ignorar en entornos sin soporte DPI heredado
            }

            bool isSelfTest = false;
            int port = DefaultPort;

            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], "--self-test", StringComparison.OrdinalIgnoreCase))
                {
                    isSelfTest = true;
                }
                else if (string.Equals(args[i], "--port", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    int parsed;
                    if (int.TryParse(args[i + 1], out parsed) && parsed > 1024 && parsed < 65535)
                    {
                        port = parsed;
                    }
                    i++;
                }
            }

            string exeDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string projectRoot = ResolveProjectRoot(exeDir);
            string logDir = Path.Combine(projectRoot, "logs");
            Directory.CreateDirectory(logDir);
            string launcherLog = Path.Combine(logDir, "vozstudio_launcher.log");

            try
            {
                string pythonwPath = ResolvePythonwPath();
                string browserPath = ResolveChromiumBrowserPath();
                string profileDir = Path.Combine(projectRoot, ".kiosk_profile");
                Rectangle workArea = Screen.PrimaryScreen != null
                    ? Screen.PrimaryScreen.WorkingArea
                    : new Rectangle(0, 0, 1920, 1040);

                PrepareCleanKioskProfile(profileDir, workArea);

                if (isSelfTest)
                {
                    string reportPath = Path.Combine(logDir, "launcher_selftest.json");
                    string json = "{\n"
                        + "  \"status\": \"ok\",\n"
                        + "  \"project_root\": \"" + EscapeJson(projectRoot) + "\",\n"
                        + "  \"pythonw\": \"" + EscapeJson(pythonwPath) + "\",\n"
                        + "  \"browser\": \"" + EscapeJson(browserPath) + "\",\n"
                        + "  \"profile_dir\": \"" + EscapeJson(profileDir) + "\",\n"
                        + "  \"work_area\": { \"x\": " + workArea.X + ", \"y\": " + workArea.Y
                        + ", \"width\": " + workArea.Width + ", \"height\": " + workArea.Height + " }\n"
                        + "}";
                    File.WriteAllText(reportPath, json, new UTF8Encoding(false));
                    return 0;
                }

                bool createdNew;
                using (Mutex singleMutex = new Mutex(true, MutexName, out createdNew))
                {
                    EnsureModelJunctions(projectRoot, launcherLog);
                    EnsureProductionUiBuild(projectRoot, launcherLog);

                    string baseUrl = "http://" + DefaultHost + ":" + port.ToString();
                    string statusUrl = baseUrl + "/api/v1/system/status";

                    Process spawnedBackend = null;
                    bool alreadyRunning = CheckBackendHealthy(statusUrl, 700);

                    if (!alreadyRunning)
                    {
                        LogLine(launcherLog, "Iniciando servidor backend silencioso en " + baseUrl);
                        spawnedBackend = StartSilentBackend(projectRoot, pythonwPath, port);
                        bool becameReady = WaitForBackendReady(statusUrl, spawnedBackend, 30000);
                        if (!becameReady)
                        {
                            TerminateProcessTreeSafe(spawnedBackend);
                            MessageBox.Show(
                                "El motor local VozStudio Omni-ES no respondio a tiempo.\nRevisa logs\\vozstudio_backend.log para mas detalles.",
                                "VozStudio Omni-ES",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Error
                            );
                            return 2;
                        }
                    }
                    else
                    {
                        LogLine(launcherLog, "Backend existente detectado activo en " + baseUrl);
                    }

                    Process uiProcess = null;
                    try
                    {
                        LogLine(launcherLog, "Abriendo ventana independiente Kiosko-WorkArea con: " + browserPath);
                        uiProcess = StartChromelessWorkAreaWindow(browserPath, baseUrl + "/", profileDir, workArea);
                        ApplyDarkObsidianWindowFrame(uiProcess, workArea);

                        if (uiProcess != null && !uiProcess.HasExited)
                        {
                            uiProcess.WaitForExit();
                        }
                    }
                    finally
                    {
                        if (spawnedBackend != null)
                        {
                            LogLine(launcherLog, "Ventana cerrada; liberando VRAM/RAM y deteniendo servidor backend.");
                            RequestGracefulEngineUnload(baseUrl + "/api/v1/engines/unload");
                            TerminateProcessTreeSafe(spawnedBackend);
                        }
                    }
                }

                return 0;
            }
            catch (Exception ex)
            {
                LogLine(launcherLog, "ERROR FATAL: " + ex.ToString());
                if (!isSelfTest)
                {
                    MessageBox.Show(
                        "Error al iniciar VozStudio Omni-ES:\n" + ex.Message,
                        "VozStudio Omni-ES",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                return 1;
            }
        }

        private static string ResolveProjectRoot(string exeDir)
        {
            string candidate = exeDir;
            for (int depth = 0; depth < 4; depth++)
            {
                if (Directory.Exists(Path.Combine(candidate, "src")) &&
                    Directory.Exists(Path.Combine(candidate, "scripts")))
                {
                    return candidate;
                }
                DirectoryInfo parent = Directory.GetParent(candidate);
                if (parent == null) break;
                candidate = parent.FullName;
            }
            return @"C:\antigravityAS\VozStudio-Omni-ES";
        }

        private static string ResolvePythonwPath()
        {
            string envOverride = Environment.GetEnvironmentVariable("VOZSTUDIO_PYTHONW");
            if (!string.IsNullOrEmpty(envOverride) && File.Exists(envOverride))
            {
                return envOverride;
            }

            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] candidates = new string[]
            {
                Path.Combine(userProfile, "miniconda3", "pythonw.exe"),
                @"C:\Users\Benner\miniconda3\pythonw.exe",
                Path.Combine(userProfile, "anaconda3", "pythonw.exe"),
                Path.Combine(localAppData, "Programs", "Python", "Python313", "pythonw.exe"),
                Path.Combine(localAppData, "Programs", "Python", "Python311", "pythonw.exe")
            };

            foreach (string c in candidates)
            {
                if (File.Exists(c)) return c;
            }

            string fromPath = FindExecutableInPath("pythonw.exe");
            if (!string.IsNullOrEmpty(fromPath)) return fromPath;

            string pyFallback = FindExecutableInPath("python.exe");
            if (!string.IsNullOrEmpty(pyFallback)) return pyFallback;

            throw new FileNotFoundException("No se encontro pythonw.exe en el sistema.");
        }

        private static string ResolveChromiumBrowserPath()
        {
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string progFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            // Prioridad 1: Google Chrome (contenedor --app puro sin barra lateral ni servicios promocionales extra)
            // Prioridad 2: Microsoft Edge (nativo en Windows 11)
            string[] candidates = new string[]
            {
                Path.Combine(progFiles, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(progFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(progFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(progFiles, "Microsoft", "Edge", "Application", "msedge.exe")
            };

            foreach (string c in candidates)
            {
                if (!string.IsNullOrEmpty(c) && File.Exists(c)) return c;
            }

            throw new FileNotFoundException("No se encontro Chrome ni Microsoft Edge para renderizar la ventana independiente.");
        }

        private static string FindExecutableInPath(string exeName)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            string[] parts = pathEnv.Split(';');
            foreach (string dir in parts)
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    string full = Path.Combine(dir.Trim(), exeName);
                    if (File.Exists(full)) return full;
                }
                catch
                {
                }
            }
            return null;
        }

        private static void EnsureModelJunctions(string projectRoot, string logFile)
        {
            string kokoroLink = Path.Combine(projectRoot, "models_link", "kokoro-v1_0-onnx");
            if (Directory.Exists(kokoroLink)) return;

            string setupScript = Path.Combine(projectRoot, "scripts", "setup_links.ps1");
            if (!File.Exists(setupScript)) return;

            string pwsh = FindExecutableInPath("pwsh.exe") ?? FindExecutableInPath("powershell.exe") ?? "powershell.exe";
            LogLine(logFile, "Configurando enlaces a modelos de forma oculta...");
            RunHiddenProcessAndWait(
                pwsh,
                "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + setupScript + "\"",
                projectRoot,
                25000
            );
        }

        private static void EnsureProductionUiBuild(string projectRoot, string logFile)
        {
            string distIndex = Path.Combine(projectRoot, "src", "ui", "dist", "index.html");
            if (File.Exists(distIndex)) return;

            string uiDir = Path.Combine(projectRoot, "src", "ui");
            string npmCmd = FindExecutableInPath("npm.cmd") ?? "npm.cmd";
            LogLine(logFile, "Compilando bundle UI de produccion en modo oculto...");
            RunHiddenProcessAndWait(npmCmd, "run build", uiDir, 90000);
        }

        private static void RunHiddenProcessAndWait(string fileName, string arguments, string workDir, int timeoutMs)
        {
            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                WorkingDirectory = workDir,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            using (Process p = Process.Start(psi))
            {
                if (p != null)
                {
                    p.WaitForExit(timeoutMs);
                }
            }
        }

        private static Process StartSilentBackend(string projectRoot, string pythonwPath, int port)
        {
            string pythonRoot = Path.GetDirectoryName(pythonwPath) ?? string.Empty;
            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = pythonwPath,
                Arguments = "-m src.main.headless_server --host " + DefaultHost + " --port " + port.ToString(),
                WorkingDirectory = projectRoot,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            psi.EnvironmentVariables["PYTHONPATH"] = projectRoot;
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            psi.EnvironmentVariables["PYTHONUTF8"] = "1";
            psi.EnvironmentVariables["OLIVE_GPU_MEMORY_LIMIT"] = "25";
            psi.EnvironmentVariables["OLIVE_CPU_THREADS"] = "12";
            psi.EnvironmentVariables["ORT_DML_DEVICE_ID"] = "0";
            psi.EnvironmentVariables["VOZSTUDIO_HOST"] = DefaultHost;
            psi.EnvironmentVariables["VOZSTUDIO_PORT"] = port.ToString();

            if (!string.IsNullOrEmpty(pythonRoot))
            {
                string currentPath = psi.EnvironmentVariables["PATH"] ?? string.Empty;
                string condaBins = pythonRoot + ";"
                    + Path.Combine(pythonRoot, "Library", "bin") + ";"
                    + Path.Combine(pythonRoot, "Scripts") + ";";
                psi.EnvironmentVariables["PATH"] = condaBins + currentPath;
            }

            return Process.Start(psi);
        }

        private static bool CheckBackendHealthy(string statusUrl, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(statusUrl);
                req.Method = "GET";
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                req.Proxy = null;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return (int)resp.StatusCode == 200;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool WaitForBackendReady(string statusUrl, Process backendProc, int maxWaitMs)
        {
            Stopwatch sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < maxWaitMs)
            {
                if (backendProc != null && backendProc.HasExited)
                {
                    return false;
                }
                if (CheckBackendHealthy(statusUrl, 900))
                {
                    return true;
                }
                Thread.Sleep(180);
            }
            return false;
        }

        private static void PrepareCleanKioskProfile(string profileDir, Rectangle workArea)
        {
            string defaultDir = Path.Combine(profileDir, "Default");
            Directory.CreateDirectory(defaultDir);

            string firstRunSentinel = Path.Combine(profileDir, "First Run");
            if (!File.Exists(firstRunSentinel))
            {
                File.WriteAllText(firstRunSentinel, string.Empty, new UTF8Encoding(false));
            }

            // Pre-semilla de Preferences limpia: bloquea popups, notificaciones, burbuja de restauracion,
            // traductor, autocompletado intrusivo, barra lateral y promociones.
            string prefsPath = Path.Combine(defaultDir, "Preferences");
            string cleanPrefs = "{\n"
                + "  \"browser\": {\n"
                + "    \"has_seen_welcome_page\": true,\n"
                + "    \"check_default_browser\": false,\n"
                + "    \"window_placement\": {\n"
                + "      \"left\": " + workArea.Left + ",\n"
                + "      \"top\": " + workArea.Top + ",\n"
                + "      \"right\": " + workArea.Right + ",\n"
                + "      \"bottom\": " + workArea.Bottom + ",\n"
                + "      \"maximized\": true,\n"
                + "      \"work_area_left\": " + workArea.Left + ",\n"
                + "      \"work_area_top\": " + workArea.Top + ",\n"
                + "      \"work_area_right\": " + workArea.Right + ",\n"
                + "      \"work_area_bottom\": " + workArea.Bottom + "\n"
                + "    }\n"
                + "  },\n"
                + "  \"profile\": {\n"
                + "    \"exit_type\": \"Normal\",\n"
                + "    \"exited_cleanly\": true,\n"
                + "    \"password_manager_enabled\": false,\n"
                + "    \"default_content_setting_values\": {\n"
                + "      \"notifications\": 2,\n"
                + "      \"popups\": 2,\n"
                + "      \"ads\": 2\n"
                + "    }\n"
                + "  },\n"
                + "  \"translate\": { \"enabled\": false },\n"
                + "  \"promotions_enabled\": false\n"
                + "}";
            File.WriteAllText(prefsPath, cleanPrefs, new UTF8Encoding(false));
        }

        private static Process StartChromelessWorkAreaWindow(
            string browserPath,
            string appUrl,
            string profileDir,
            Rectangle workArea)
        {
            List<string> flags = new List<string>
            {
                "--app=" + appUrl,
                "--user-data-dir=\"" + profileDir + "\"",
                "--window-position=" + workArea.X + "," + workArea.Y,
                "--window-size=" + workArea.Width + "," + workArea.Height,
                "--start-maximized",
                "--force-dark-mode",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                "--disable-component-extensions-with-background-pages",
                "--disable-default-apps",
                "--disable-notifications",
                "--disable-infobars",
                "--disable-session-crashed-bubble",
                "--disable-sync",
                "--disable-translate",
                "--disable-background-networking",
                "--disable-background-mode",
                "--no-service-autorun",
                "--disable-client-side-phishing-detection",
                "--disable-domain-reliability",
                "--disable-component-update",
                "--block-new-web-contents",
                "--autoplay-policy=no-user-gesture-required",
                "--disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,ChromeWhatsNewUI,msEdgeSidebarV2,msHubApps,msWelcomePage,EdgeCollections,msImplicitSignin"
            };

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = browserPath,
                Arguments = string.Join(" ", flags.ToArray()),
                CreateNoWindow = true,
                UseShellExecute = false
            };

            return Process.Start(psi);
        }

        private static void ApplyDarkObsidianWindowFrame(Process uiProcess, Rectangle workArea)
        {
            if (uiProcess == null) return;

            Stopwatch sw = Stopwatch.StartNew();
            IntPtr hwnd = IntPtr.Zero;
            while (sw.ElapsedMilliseconds < 6000 && !uiProcess.HasExited)
            {
                uiProcess.Refresh();
                hwnd = uiProcess.MainWindowHandle;
                if (hwnd != IntPtr.Zero) break;
                Thread.Sleep(120);
            }

            if (hwnd == IntPtr.Zero) return;

            try
            {
                int dark = 1;
                // COLORREF en formato 0x00BBGGRR: #060A12 -> R=0x06, G=0x0A, B=0x12 -> 0x00120A06
                int obsidianCaption = 0x00120A06;
                int subtleBorder = 0x00261A0E;
                int crispText = 0x00F0E8E2;

                NativeMethods.DwmSetWindowAttribute(hwnd, NativeMethods.DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
                NativeMethods.DwmSetWindowAttribute(hwnd, NativeMethods.DWMWA_CAPTION_COLOR, ref obsidianCaption, sizeof(int));
                NativeMethods.DwmSetWindowAttribute(hwnd, NativeMethods.DWMWA_BORDER_COLOR, ref subtleBorder, sizeof(int));
                NativeMethods.DwmSetWindowAttribute(hwnd, NativeMethods.DWMWA_TEXT_COLOR, ref crispText, sizeof(int));

                NativeMethods.MoveWindow(hwnd, workArea.X, workArea.Y, workArea.Width, workArea.Height, true);
                NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOWMAXIMIZED);
                NativeMethods.SetForegroundWindow(hwnd);
            }
            catch
            {
                // Ignorar si la version de DWM no soporta atributos extendidos
            }
        }

        private static void RequestGracefulEngineUnload(string unloadUrl)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(unloadUrl);
                req.Method = "POST";
                req.ContentLength = 0;
                req.Timeout = 1200;
                req.Proxy = null;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                }
            }
            catch
            {
            }
        }

        private static void TerminateProcessTreeSafe(Process proc)
        {
            if (proc == null) return;
            try
            {
                if (!proc.HasExited)
                {
                    RunHiddenProcessAndWait(
                        "taskkill.exe",
                        "/PID " + proc.Id.ToString() + " /T /F",
                        AppDomain.CurrentDomain.BaseDirectory,
                        4000
                    );
                }
            }
            catch
            {
                try { if (!proc.HasExited) proc.Kill(); } catch { }
            }
        }

        private static void LogLine(string logFile, string message)
        {
            try
            {
                string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " | " + message + Environment.NewLine;
                File.AppendAllText(logFile, line, new UTF8Encoding(false));
            }
            catch
            {
            }
        }

        private static string EscapeJson(string s)
        {
            if (s == null) return string.Empty;
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
