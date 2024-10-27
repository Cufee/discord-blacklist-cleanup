import { Bot as App, createBot, Message } from "npm:@discordeno/bot";
import { Result } from "./main.ts";

export class Bot {
  private token: string;
  private app: App;

  constructor(token: string) {
    this.token = token;
    this.app = createBot({
      token: this.token,
      events: {
        ready: (data) => {
          console.log(`The shard ${data.shardId} is ready!`);
        },
      },
    });
  }

  start() {
    return this.app.start();
  }

  async sendChannelMessage(
    channel: string,
    message: string,
  ): Promise<Result<Message>> {
    try {
      const data = await this.app.helpers.sendMessage(channel, {
        content: message,
      });
      if (data.id.toString().length < 3) {
        return { ok: false, error: "failed to send a message" };
      }
      return { data, ok: true };
    } catch (error) {
      return { ok: false, error: error.toString() };
    }
  }
}
