import pc from "picocolors";

export function printBanner(): void {
  console.log(
    pc.cyan(String.raw`
   ____                 _     ____   _          _ 
  / ___| ___   ___   __| |   / ___| (_)  _ __  | |
 | |  _ / _ \ / _ \ / _' |  | |  _  | | | '__| | |
 | |_| | (_) | (_) | (_| |  | |_| | | | | |    | |
  \____|\___/ \___/ \__,_|   \____| |_| |_|    |_|
`),
  );
  console.log(
    ` ${pc.bold("GoodGirl CLI")} — ${pc.dim("All-in-One QA Automation Toolkit v0.1.0")}\n`,
  );
}
