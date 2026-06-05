import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";

export let main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "This is the main intent for the application",
  state,
});

main.onResolution = async () => {
  "Hello world".sendResponse();
};
