import { Bot } from "./bot.ts";
import { Discord } from "./discord.ts";

const notify = async (bot: Bot, message: string) => {
  const channel = Deno.env.get("NOTIFY_CHANNEL_ID") || "";
  if (!channel) {
    console.error(
      "failed to send a notification to channel - channel id not provided",
      "message: " + message,
    );
    return;
  }

  const res = await bot.sendChannelMessage(
    channel,
    message,
  );
  if (!res.ok) {
    console.error(
      "failed to send a notification to channel",
      "message: " + message,
    );
  }
};

export const startCronJob = (discord: Discord, bot: Bot) => {
  Deno.cron("Cleanup blocklist", "0 * * * *", async () => {
    // Verify the token is still valid
    const valid = await discord.validateToken();
    if (!valid) {
      return await notify(bot, "user token is invalid");
    }

    await cleanup(discord, bot);
  });
};

export const cleanup = async (discord: Discord, bot: Bot) => {
  const relationships = await discord.getRelationships();
  if (!relationships.ok) {
    return await notify(
      bot,
      "failed to get relationships: " + relationships.error,
    );
  }

  // shuffle to avoid re-checking the same users on each run in the same order
  const blockedUsers = shuffle(relationships.data.filter((r) => r.type === 2));

  for (let i = 0; i < blockedUsers.length - 1; i++) {
    const rel = blockedUsers[i];
    setTimeout(async () => {
      console.debug("looking up user profile", rel.id);
      const profile = await discord.getUserProfile(rel.user.id);
      if (!profile.ok) {
        if (profile.error === "too many requests") {
          console.error("too many requests", `retry in ${profile.context}`);
          Deno.exit(1);
        }

        if (profile.error === "not found") {
          console.debug("deleting a relationship (user deleted)", rel.id);
          await discord.deleteRelationship(rel.id);
          return;
        }
        notify(bot, "failed to get user profile for " + rel.user.id);
        return;
      }

      // has no mutual servers
      if (profile.data.mutual_guilds.length === 0) {
        console.debug("deleting a relationship (no mutuals)", rel.id);
        await discord.deleteRelationship(rel.id);
        return;
      }

      console.debug("skipped", rel.id);
    }, i * 5000);
  }
};

function shuffle<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
