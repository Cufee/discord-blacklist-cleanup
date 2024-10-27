import { Bot } from "./bot.ts";
import { Discord } from "./discord.ts";
import { getCachedProfile, saveProfileCache } from "./store.ts";

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

  const blockedUsers = relationships.data.filter((r) => r.type === 2);
  for (let i = 0; i < blockedUsers.length - 1; i++) {
    const rel = blockedUsers[i];
    setTimeout(async () => {
      console.debug("looking up user profile", rel.id);
      let profileCache = await getCachedProfile(rel.user.id);
      if (!profileCache.ok) {
        // user profile not in cache
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

        profileCache = await saveProfileCache(profile.data);
        if (!profileCache.ok) {
          notify(bot, "failed to save user profile cache for " + rel.user.id);
          return;
        }
      }

      // has no mutual servers
      if (profileCache.data.mutual_guilds.length === 0) {
        console.debug("deleting a relationship (no mutuals)", rel.id);
        await discord.deleteRelationship(rel.id);
        return;
      }

      console.debug("skipped", rel.id);
    }, i * 3000);
  }
};
