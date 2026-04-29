// Web Worker for Pyodide Execution
// Loads Pyodide from CDN and handles Python code execution

importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js");

let pyodide = null;
let pyodideReadyPromise = null;

async function loadPyodideEnv() {
    if (pyodide) return pyodide;

    try {
        pyodide = await loadPyodide();
        // Load key scientific packages
        await pyodide.loadPackage(["numpy", "matplotlib", "pandas"]);

        // Initialize Setup for Plotting
        await pyodide.runPythonAsync(`
import sys
import io
import base64
import warnings
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
warnings.filterwarnings(
    "ignore",
    message="Matplotlib is currently using agg, which is a non-GUI backend, so cannot show the figure.",
    category=UserWarning,
)

def _get_plots_base64():
    plots = []
    # Iterate over open figures
    for i in plt.get_fignums():
        fig = plt.figure(i)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plots.append(img_str)
        plt.close(fig) # Close to avoid memory leaks
    return plots
        `);
        return pyodide;
    } catch (e) {
        console.error("Failed to load pyodide:", e);
        throw e;
    }
}

self.onmessage = async (event) => {
    const { id, action, code } = event.data;

    if (action === "init") {
        try {
            pyodideReadyPromise = loadPyodideEnv();
            await pyodideReadyPromise;
            self.postMessage({ id, type: "ready" });
        } catch (error) {
            self.postMessage({ id, type: "error", error: error.message });
        }
        return;
    }

    if (action === "run") {
        if (!pyodide) {
            self.postMessage({ id, type: "error", error: "Pyodide not loaded. Wait for initialization." });
            return;
        }

        try {
            // 1. Prepare Environment
            await pyodide.runPythonAsync(`
import sys
import io
import base64
import warnings
_mentrily_stdout = io.StringIO()
_mentrily_stderr = io.StringIO()
sys.stdout = _mentrily_stdout
sys.stderr = _mentrily_stderr
warnings.filterwarnings(
    "ignore",
    message="Matplotlib is currently using agg, which is a non-GUI backend, so cannot show the figure.",
    category=UserWarning,
)
`);

            // 2. Execute User Code
            await pyodide.runPythonAsync(code);

            // 3. Capture stdout/stderr
            const stdout = await pyodide.runPythonAsync("_mentrily_stdout.getvalue()");
            const stderr = await pyodide.runPythonAsync("_mentrily_stderr.getvalue()");
            if (stdout) self.postMessage({ id, type: "stdout", text: stdout });
            if (stderr) self.postMessage({ id, type: "stderr", text: stderr });

            // 4. Capture plots
            // check available plots
            const plotsProxy = await pyodide.runPythonAsync("_get_plots_base64()");
            const plots = plotsProxy.toJs();
            plotsProxy.destroy();

            // 5. Done
            self.postMessage({ id, type: "done", plots });

        } catch (error) {
            self.postMessage({ id, type: "error", error: error.message });
        }
    }
};
