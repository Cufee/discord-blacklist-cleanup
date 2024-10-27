import { Bot } from "./bot.ts";
import { cleanup } from "./cron.ts";
import { Discord } from "./discord.ts";

export type Result<T> = { data: T; ok: true } | {
  ok: false;
  error: string;
  context?: unknown;
};

const bot = new Bot("");
// bot.start(); // async

const discord = new Discord(Deno.env.get("DISCORD_USER_TOKEN")!);
const valid = await discord.validateToken();
if (!valid) {
  console.error("invalid user token provided");
  Deno.exit(1);
}

await cleanup(discord, bot);
