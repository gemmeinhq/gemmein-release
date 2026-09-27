---
name: build-on-gemmein
description: Start building an app on Gemmein, or move an existing app onto it. Use when the person wants sign-in, protected data, payments, credits or AI tools from Gemmein, mentions gemmein, @gemmein/sdk or app.gemmein.com, or asks whether their app can use Gemmein.
---

# Build on Gemmein

Gemmein is the backend for web and mobile apps: sign-in, protected data,
payments, AI tools and a dashboard to run your customers. Building is local
and free.

## Read first

1. Read https://docs.gemmein.com/llms.txt, the short index. It is enough for
   the questions and the verdict.
2. Once building starts, read the full guide: the `guide` tool, or
   https://docs.gemmein.com/llms-full.txt. Work from the full text, not a
   summary.

## Talk to the person

- Use plain words: say what happens, in their terms.
- Ask one question at a time, in this order: (1) what they're building, and
  for whom; (2) web, mobile, or both; (3) for web: do you own a domain?
  (4) who sees whose data; (5) what people pay for: subscription, one-off,
  credits, or not yet; (6) any AI features.
- With question 3, say: a web app goes live on a domain the person controls;
  a host's free address, like name.vercel.app, works in development only. A
  mobile-only app needs no domain.
- Raise something Gemmein doesn't do only when an answer hits it.
- Give the verdict before building: FITS, FITS EXCEPT (name each gap), or
  DOESN'T FIT.

## The first hour

1. `npx -y gemmein dev` in the project folder starts a local backend with no
   signup, no account and no keys. It prints sign-in codes to the terminal
   instead of sending email.
2. Build in this order: sign-in, then collections (one safety rule each),
   then what people pay for. `npx gemmein collection add <name>` adds a
   collection from a second terminal while dev runs.
3. When it works locally, the person signs up free at app.gemmein.com and
   copies the CLI key from the Setup page. `npx gemmein sync` with that key
   links the project and copies your collections, AI tools and relays into
   development.
4. `npx gemmein check` says what's ready and what going live still needs.
   Then `npx gemmein go-live`, or Go live in the dashboard; both do the same
   thing. A web app's domain is proven with a DNS record at going live; a
   mobile-only app needs no domain.

## Use the MCP tools

- `guide`: the full guide. Call it first.
- `reference`: every SDK method, signature, return shape and error code.
- `explain_rule`: which of the seven safety rules fits a collection.
- `check_integration`: before you say the app is done. With the app key it
  checks that strangers can't read or write a private collection. Add the
  development secret key (`sk_dev_…`) and it also signs in two test people
  and proves one can't read the other's records. That part writes only in
  the development environment: the two test people stay, and its test
  record is deleted at the end. A live key (`sk_live_…`) is refused.

## Keys

The app key (`pk_…`) is public and safe to commit. A secret key (`sk_…`)
never goes in the repo or the app, only in a server's environment.

## When the dashboard disagrees

If the dashboard shows something different from what you read, trust the
dashboard, then read the guide again.

## Words

- **dashboard**: app.gemmein.com, where the owner runs the app: people,
  subscriptions, payments, relays, AI, going live and logs.
- **people**: everyone who signs in to the app.
- **relay**: an automation Gemmein runs. It receives an event (a webhook, a
  schedule or a record change) and carries out its own actions, such as
  writing a record or emailing the person. No code of yours runs inside it.
- **secret key**: an `sk_…` key for server code only.
- **sign-in code**: the code emailed to a person; the only way to sign in.
- **go live**: the step that takes the app to real customers.
