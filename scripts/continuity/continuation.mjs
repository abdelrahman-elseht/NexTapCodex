import { renderContext, readPacket, readPacketContract, writePacket } from "./packet.mjs";

const root = process.env.AGENT_CONTINUITY_ROOT || process.cwd();
const [command, ...args] = process.argv.slice(2);

async function main() {
  if (command === "validate" || command === "validate-contract") {
    const current = command === "validate" ? await readPacket(root) : await readPacketContract(root);
    process.stdout.write(`${current.status}\n`);
    if (current.status !== "valid") process.exitCode = 1;
    return;
  }
  if (command === "save") {
    let packet;
    try {
      const chunks = [];
      let byteLength = 0;
      for await (const chunk of process.stdin) {
        const buffer = Buffer.from(chunk);
        byteLength += buffer.length;
        if (byteLength > 12_000) throw new Error("continuation input too large");
        chunks.push(buffer);
      }
      packet = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("invalid continuation input");
    }
    await writePacket(root, packet);
    process.stdout.write("saved\n");
    return;
  }
  if (command === "restore") {
    const source = args[0];
    if (source !== "compact") throw new Error("restore source must be compact");
    const current = await readPacket(root);
    if (current.status !== "valid") throw new Error(`continuation packet ${current.status}`);
    process.stdout.write(`${renderContext(current.packet)}\n`);
    return;
  }
  throw new Error("command must be validate, validate-contract, save, or restore");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
