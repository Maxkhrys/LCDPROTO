import { spawn } from "node:child_process";

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--strictPort").map((argument) => argument === "--host" ? "--hostname" : argument);
const child = spawn("next", ["dev", ...forwardedArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
