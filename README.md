# Discord Blocked Users Cleanup

Discord currently has a limit of 5000 users for the block list. While it is enough for most cases, this might be limiting for some power users.  
This script is extremely simple - if a user you have blocked was deleted or does not share a server with you, they will be unblocked.

## Running the script:
- Create a `.env` file and set the `DISCORD_USER_TOKEN` to your user authorization token (retrieved from discord.com)
- Run `deno task start`