import app from "./app";
import { checkDbConnection } from "./config/db";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  await checkDbConnection();
  console.log("[xinglian-server] mysql connection established");

  const onListen = (): void => {
    const hostHint =
      env.nodeEnv === "production" ? "0.0.0.0" : "localhost";
    console.log(
      `[xinglian-server] listening on http://${hostHint}:${env.port} (${env.nodeEnv})`
    );
  };

  if (env.nodeEnv === "production") {
    app.listen(env.port, "0.0.0.0", onListen);
  } else {
    app.listen(env.port, onListen);
  }
}

bootstrap().catch((error: Error) => {
  console.error("[xinglian-server] failed to start:", error.message);
  process.exit(1);
});
