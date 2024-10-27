import { Bot } from "./bot.ts";
import { Discord, Profile } from "./discord.ts";
import { getCachedProfile, saveProfileCache } from "./store.ts";

const notify = async (bot: Bot | null, message: string) => {
  const channel = Deno.env.get("NOTIFY_CHANNEL_ID") || "";
  if (!channel || !bot) {
    console.error(
      "failed to send a notification to channel - notifications are not configured",
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

export const cleanup = async (discord: Discord, bot: Bot | null) => {
  const relationships = await discord.getRelationships();
  if (!relationships.ok) {
    return await notify(
      bot,
      "failed to get relationships: " + relationships.error,
    );
  }

  const blockedUsers = relationships.data.filter((r) => r.type === 2);
  const workers: (() => void)[] = [];

  for (let i = 0; i < blockedUsers.length - 1; i++) {
    const rel = blockedUsers[i];

    let profileCache = await getCachedProfile(rel.user.id);
    if (profileCache.ok && !shouldDelete(profileCache.data)) {
      console.debug(
        `(${i + 1}/${blockedUsers.length})`,
        "skipped (cached)",
        rel.id,
      );
      continue;
    }

    workers.push(async () => {
      console.debug(
        `(${i + 1}/${blockedUsers.length})`,
        "looking up user profile",
        rel.id,
      );
      if (!profileCache.ok) {
        // user profile not in cache
        const profile = await discord.getUserProfile(rel.user.id);
        if (!profile.ok) {
          if (profile.error === "too many requests") {
            console.error(
              `(${i + 1}/${blockedUsers.length})`,
              "too many requests",
              `retry in ${profile.context}`,
            );
            Deno.exit(1);
          }
          if (profile.error === "not found") {
            console.debug(
              `(${i + 1}/${blockedUsers.length})`,
              "deleting a relationship (user deleted)",
              rel.id,
            );
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

      if (shouldDelete(profileCache.data)) {
        console.debug(
          `(${i + 1}/${blockedUsers.length})`,
          "deleting a relationship",
          rel.id,
        );
        await discord.deleteRelationship(rel.id);
        return;
      }

      console.debug(`(${i + 1}/${blockedUsers.length})`, "skipped", rel.id);
    });
  }

  for (let i = 0; i < workers.length - 1; i++) {
    setTimeout(workers[i], i * 3000); // this can be further tweaked, sub 2000 is likely to cause a rate limit from Cloudflare
  }
};

const shouldDelete = (profile: Profile): boolean => {
  return profile.mutual_guilds.length === 0;
};
