/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as categories from "../categories.js";
import type * as channels from "../channels.js";
import type * as directMessages from "../directMessages.js";
import type * as emojis from "../emojis.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_searchDigests from "../lib/searchDigests.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as reactions from "../reactions.js";
import type * as readPositions from "../readPositions.js";
import type * as search from "../search.js";
import type * as servers from "../servers.js";
import type * as threads from "../threads.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  categories: typeof categories;
  channels: typeof channels;
  directMessages: typeof directMessages;
  emojis: typeof emojis;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/messages": typeof lib_messages;
  "lib/normalize": typeof lib_normalize;
  "lib/presence": typeof lib_presence;
  "lib/searchDigests": typeof lib_searchDigests;
  messages: typeof messages;
  migrations: typeof migrations;
  notifications: typeof notifications;
  reactions: typeof reactions;
  readPositions: typeof readPositions;
  search: typeof search;
  servers: typeof servers;
  threads: typeof threads;
  typing: typeof typing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
