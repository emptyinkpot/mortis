import { describe, expect, it } from "vitest";
import {
  buildInternalGroupChatIssueDraft,
  INTERNAL_GROUP_CHAT_MARKER,
  INTERNAL_GROUP_CHAT_TITLE,
  isInternalGroupChatIssue,
} from "./internal-group-chat";

describe("internal-group-chat helpers", () => {
  it("builds the canonical backing issue draft", () => {
    const draft = buildInternalGroupChatIssueDraft();

    expect(draft.title).toBe(INTERNAL_GROUP_CHAT_TITLE);
    expect(draft.status).toBe("todo");
    expect(draft.priority).toBe("none");
    expect(draft.description).toContain(INTERNAL_GROUP_CHAT_MARKER);
  });

  it("detects only the dedicated backing issue", () => {
    expect(
      isInternalGroupChatIssue({
        title: "别的事项",
        description: `hello\n${INTERNAL_GROUP_CHAT_MARKER}\nworld`,
      }),
    ).toBe(true);

    expect(
      isInternalGroupChatIssue({
        title: INTERNAL_GROUP_CHAT_TITLE,
        description: null,
      }),
    ).toBe(true);

    expect(
      isInternalGroupChatIssue({
        title: "普通事项",
        description: "普通事项，不是内部群聊。",
      }),
    ).toBe(false);
  });
});
