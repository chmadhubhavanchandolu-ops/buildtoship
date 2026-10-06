import { db } from "@workspace/db";
import {
  conversationMessagesTable,
  conversationsTable,
  internalNotesTable,
  knowledgeArticlesTable,
  supportSettingsTable,
  supportUsersTable,
} from "@workspace/db";

const customers = [
  ["customer-001", "Maya Chen", "maya.chen@example.com", "MC"],
  ["customer-002", "Ethan Brooks", "ethan.brooks@example.com", "EB"],
  ["customer-003", "Sofia Patel", "sofia.patel@example.com", "SP"],
  ["customer-004", "Noah Williams", "noah.williams@example.com", "NW"],
  ["customer-005", "Amara Johnson", "amara.johnson@example.com", "AJ"],
] as const;

const agents = [
  ["agent-001", "Riley Morgan", "riley@supportdesk.demo", "RM"],
  ["agent-002", "Alex Rivera", "alex@supportdesk.demo", "AR"],
  ["agent-003", "Sam Taylor", "sam@supportdesk.demo", "ST"],
] as const;

const articles = [
  {
    id: "faq-01",
    question: "How do I reset my password?",
    answer:
      "On the sign-in page, select “Forgot password” and enter the email address on your account. We’ll send a reset link that expires after 30 minutes. Check your spam folder if it doesn’t arrive.",
    category: "Account",
    keywords: ["password", "reset", "forgot", "sign in", "login"],
  },
  {
    id: "faq-02",
    question: "How can I update my account details?",
    answer:
      "Open Profile → Account details to update your name, email address, or phone number. Email changes require confirmation from both your current and new address.",
    category: "Account",
    keywords: ["account", "profile", "details", "email", "phone", "update"],
  },
  {
    id: "faq-03",
    question: "Where can I check the status of my order?",
    answer:
      "Open Orders in your account and select an order to see its latest status and tracking link. Tracking can take up to 24 hours to appear after dispatch.",
    category: "Orders",
    keywords: ["order", "track", "status", "tracking", "where"],
  },
  {
    id: "faq-04",
    question: "What payment methods are supported?",
    answer:
      "We accept Visa, Mastercard, American Express, and PayPal. Available payment methods are shown at checkout and can vary by region.",
    category: "Payments",
    keywords: ["payment", "pay", "card", "visa", "mastercard", "paypal", "methods"],
  },
  {
    id: "faq-05",
    question: "How do I request a refund?",
    answer:
      "Go to Orders, choose the delivered order, then select Request a return or refund. Eligible returns must be requested within 30 days of delivery. Refunds are issued to the original payment method after the return is inspected.",
    category: "Refunds",
    keywords: ["refund", "return", "money back", "request", "eligible"],
  },
  {
    id: "faq-06",
    question: "How long does shipping take?",
    answer:
      "Standard shipping usually takes 3–5 business days after dispatch. Express shipping usually takes 1–2 business days. Your order confirmation includes the selected shipping option.",
    category: "Shipping",
    keywords: ["shipping", "delivery", "arrive", "days", "express"],
  },
  {
    id: "faq-07",
    question: "Can I cancel my order?",
    answer:
      "You can request cancellation from Orders while an order is still processing. Once it has shipped, cancellation is no longer available; you can request a return after delivery.",
    category: "Cancellation",
    keywords: ["cancel", "cancellation", "stop", "order"],
  },
  {
    id: "faq-08",
    question: "Why is my payment being declined?",
    answer:
      "A declined payment can be caused by an incorrect billing address, an expired card, or a bank authorization check. Confirm your billing details or try another payment method. For a charge you don’t recognize or repeated failures, contact support so an agent can review it.",
    category: "Payments",
    keywords: ["payment", "declined", "failed", "card", "charge"],
  },
  {
    id: "faq-09",
    question: "How do I change my shipping address?",
    answer:
      "Open Orders and select Change address if the order is still processing. Address changes are unavailable after an order has shipped.",
    category: "Shipping",
    keywords: ["shipping", "address", "change", "delivery"],
  },
  {
    id: "faq-10",
    question: "How do I return an item?",
    answer:
      "Open Orders, select the delivered item, and choose Start a return. Follow the return instructions shown for that order. Items must be returned in their original condition within 30 days of delivery.",
    category: "Refunds",
    keywords: ["return", "item", "send back", "label", "refund"],
  },
  {
    id: "faq-11",
    question: "Can I use more than one discount code?",
    answer:
      "Only one discount code can be applied to an order. Enter the code at checkout before placing your order.",
    category: "Orders",
    keywords: ["discount", "promo", "coupon", "code", "multiple"],
  },
  {
    id: "faq-12",
    question: "How do I contact support?",
    answer:
      "You can start a conversation from the Help section of your account. If an automated answer can’t resolve your issue, request a human agent and the conversation will be added to the support queue.",
    category: "Technical Support",
    keywords: ["contact", "support", "human", "agent", "help"],
  },
  {
    id: "faq-13",
    question: "The website is not loading. What can I try?",
    answer:
      "Refresh the page, clear your browser cache, and try a current version of Chrome, Safari, Firefox, or Edge. If the issue continues, tell support which page you were visiting and what you saw.",
    category: "Technical Support",
    keywords: ["website", "site", "loading", "browser", "error", "technical"],
  },
  {
    id: "faq-14",
    question: "How can I delete my account?",
    answer:
      "Open Profile → Privacy and select Delete account. Account deletion is permanent. If you have an open order or support ticket, contact support before submitting the request.",
    category: "Account",
    keywords: ["delete", "close", "account", "privacy"],
  },
  {
    id: "faq-15",
    question: "I received the wrong item. What should I do?",
    answer:
      "Open Orders, select the affected order, and choose Report a problem. Include the item you expected and the item you received. A support agent will review the report.",
    category: "Orders",
    keywords: ["wrong item", "incorrect", "missing", "order", "received"],
  },
  {
    id: "faq-16",
    question: "When will my refund arrive?",
    answer:
      "After a return is approved, refunds are sent to the original payment method. Most banks post the funds within 5–10 business days; timing depends on your bank.",
    category: "Refunds",
    keywords: ["refund", "when", "arrive", "pending", "bank"],
  },
] as const;

const demoConversations = [
  {
    id: "conversation-001",
    customerId: "customer-001",
    assignedAgentId: null,
    status: "waiting_for_agent" as const,
    priority: "medium" as const,
    aiConfidence: 0.42,
    escalationReason: "The order cancellation failed and requires manual verification.",
    intent: "Cancellation",
    summary: "Customer tried to cancel order #10245, but the cancellation failed.",
    recommendedNextAction: "Check the order state and verify whether cancellation is still possible.",
    ticketNumber: "SD-10245",
    aiResolved: false,
    daysAgo: 0,
    customerMessage: "I tried to cancel order #10245 but it failed. Can someone check?",
    aiMessage:
      "I can’t verify the order’s cancellation status from here. I’ve sent this to a support agent to review.",
  },
  {
    id: "conversation-002",
    customerId: "customer-002",
    assignedAgentId: null,
    status: "ai_handling" as const,
    priority: "low" as const,
    aiConfidence: 0.94,
    escalationReason: null,
    intent: "Password reset",
    summary: null,
    recommendedNextAction: null,
    ticketNumber: null,
    aiResolved: true,
    daysAgo: 0,
    customerMessage: "How can I reset my password?",
    aiMessage:
      "On the sign-in page, select “Forgot password” and enter the email address on your account. We’ll send a reset link that expires after 30 minutes. Check your spam folder if it doesn’t arrive.",
  },
  {
    id: "conversation-003",
    customerId: "customer-003",
    assignedAgentId: "agent-001",
    status: "in_progress" as const,
    priority: "high" as const,
    aiConfidence: 0.35,
    escalationReason: "Payment failed repeatedly and needs a secure transaction review.",
    intent: "Payment issue",
    summary: "Customer reports repeated payment failures at checkout.",
    recommendedNextAction: "Review payment processor status without requesting full card details.",
    ticketNumber: "SD-10244",
    aiResolved: false,
    daysAgo: 0,
    customerMessage: "My payment failed three times at checkout.",
    aiMessage:
      "I can’t inspect a payment attempt. I’ve routed this to an agent for a secure review. Please don’t share full card details in chat.",
  },
  {
    id: "conversation-004",
    customerId: "customer-004",
    assignedAgentId: null,
    status: "resolved" as const,
    priority: "low" as const,
    aiConfidence: 0.92,
    escalationReason: null,
    intent: "Refund timing",
    summary: null,
    recommendedNextAction: null,
    ticketNumber: null,
    aiResolved: true,
    daysAgo: 1,
    customerMessage: "When should I expect my refund?",
    aiMessage:
      "Most banks post an approved refund within 5–10 business days. Timing depends on your bank.",
  },
  {
    id: "conversation-005",
    customerId: "customer-005",
    assignedAgentId: null,
    status: "waiting_for_agent" as const,
    priority: "critical" as const,
    aiConfidence: 0.18,
    escalationReason: "Customer reports possible unauthorized access to their account.",
    intent: "Account security",
    summary: "Customer says they noticed a sign-in they do not recognize.",
    recommendedNextAction: "Verify the customer through the approved account-security process.",
    ticketNumber: "SD-10243",
    aiResolved: false,
    daysAgo: 1,
    customerMessage: "I see a login on my account that wasn't me.",
    aiMessage:
      "I’m sending this to a support agent for a security review. For your safety, don’t share passwords or verification codes here.",
  },
  {
    id: "conversation-006",
    customerId: "customer-001",
    assignedAgentId: null,
    status: "resolved" as const,
    priority: "low" as const,
    aiConfidence: 0.9,
    escalationReason: null,
    intent: "Account details",
    summary: null,
    recommendedNextAction: null,
    ticketNumber: null,
    aiResolved: true,
    daysAgo: 2,
    customerMessage: "Where can I update the email on my account?",
    aiMessage:
      "Open Profile → Account details to update your email. You’ll need to confirm the change from both addresses.",
  },
  {
    id: "conversation-007",
    customerId: "customer-002",
    assignedAgentId: "agent-002",
    status: "assigned" as const,
    priority: "medium" as const,
    aiConfidence: 0.53,
    escalationReason: "The delivery is substantially delayed and needs order-specific verification.",
    intent: "Delayed delivery",
    summary: "Customer says their package is several days past the expected delivery date.",
    recommendedNextAction: "Check the carrier scan and confirm the latest delivery estimate.",
    ticketNumber: "SD-10242",
    aiResolved: false,
    daysAgo: 2,
    customerMessage: "My delivery is five days late and tracking hasn't changed.",
    aiMessage:
      "I can’t see carrier scans for your order. I’ve put this in the support queue so an agent can check the shipment.",
  },
  {
    id: "conversation-008",
    customerId: "customer-003",
    assignedAgentId: null,
    status: "resolved" as const,
    priority: "low" as const,
    aiConfidence: 0.96,
    escalationReason: null,
    intent: "Payment methods",
    summary: null,
    recommendedNextAction: null,
    ticketNumber: null,
    aiResolved: true,
    daysAgo: 3,
    customerMessage: "Do you take PayPal?",
    aiMessage:
      "Yes. We accept Visa, Mastercard, American Express, and PayPal. Available options appear at checkout and can vary by region.",
  },
  {
    id: "conversation-009",
    customerId: "customer-004",
    assignedAgentId: "agent-003",
    status: "in_progress" as const,
    priority: "medium" as const,
    aiConfidence: 0.48,
    escalationReason: "Customer reports a technical error that needs reproduction.",
    intent: "Technical support",
    summary: "Customer sees an error while opening the order details page.",
    recommendedNextAction: "Reproduce the issue and check for a service incident.",
    ticketNumber: "SD-10241",
    aiResolved: false,
    daysAgo: 4,
    customerMessage: "I get an error when I open my order details.",
    aiMessage:
      "I don’t have enough information to identify the error. I’ve forwarded this to an agent to investigate.",
  },
  {
    id: "conversation-010",
    customerId: "customer-005",
    assignedAgentId: null,
    status: "resolved" as const,
    priority: "low" as const,
    aiConfidence: 0.88,
    escalationReason: null,
    intent: "Shipping time",
    summary: null,
    recommendedNextAction: null,
    ticketNumber: null,
    aiResolved: true,
    daysAgo: 5,
    customerMessage: "How long does standard shipping take?",
    aiMessage: "Standard shipping usually takes 3–5 business days after dispatch.",
  },
  {
    id: "conversation-011",
    customerId: "customer-002",
    assignedAgentId: null,
    status: "waiting_for_agent" as const,
    priority: "high" as const,
    aiConfidence: 0.29,
    escalationReason: "Customer says they were charged twice; requires transaction verification.",
    intent: "Duplicate charge",
    summary: "Customer reports two charges for one order.",
    recommendedNextAction: "Compare the charge references and confirm whether one is a pending authorization.",
    ticketNumber: "SD-10240",
    aiResolved: false,
    daysAgo: 6,
    customerMessage: "I think I was charged twice for the same order.",
    aiMessage:
      "I can’t inspect individual charges. I’ve routed this to an agent to review securely. Please don’t share full card details in chat.",
  },
] as const;

export async function seedDemoData(): Promise<void> {
  const now = new Date();
  const userRows = [
    ...customers.map(([id, name, email, avatar]) => ({
      id,
      name,
      email,
      role: "customer" as const,
      avatar,
    })),
    ...agents.map(([id, name, email, avatar]) => ({
      id,
      name,
      email,
      role: "agent" as const,
      avatar,
    })),
    {
      id: "admin-001",
      name: "Jordan Ellis",
      email: "admin@supportdesk.demo",
      role: "admin" as const,
      avatar: "JE",
    },
  ];

  await db.insert(supportUsersTable).values(userRows).onConflictDoNothing();
  await db
    .insert(knowledgeArticlesTable)
    .values(
      articles.map((article) => ({
        ...article,
        keywords: [...article.keywords],
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  const conversations = demoConversations.map((conversation) => {
    const { daysAgo, ...record } = conversation;
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      ...record,
      createdAt,
      updatedAt: createdAt,
      resolvedAt:
        record.status === "resolved"
          ? new Date(createdAt.getTime() + 8 * 60 * 1000)
          : null,
    };
  });
  await db.insert(conversationsTable).values(conversations).onConflictDoNothing();

  const messages = demoConversations.flatMap((conversation) => {
    const { daysAgo } = conversation;
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return [
      {
        id: `${conversation.id}-customer`,
        conversationId: conversation.id,
        senderType: "customer" as const,
        senderName: customers.find(([id]) => id === conversation.customerId)?.[1] ?? "Customer",
        content: conversation.customerMessage,
        confidence: null,
        helpful: null,
        createdAt,
      },
      {
        id: `${conversation.id}-ai`,
        conversationId: conversation.id,
        senderType: "ai" as const,
        senderName: "SupportDesk AI",
        content: conversation.aiMessage,
        confidence: conversation.aiConfidence,
        helpful: null,
        createdAt: new Date(createdAt.getTime() + 45_000),
      },
    ];
  });
  await db.insert(conversationMessagesTable).values(messages).onConflictDoNothing();

  await db
    .insert(internalNotesTable)
    .values([
      {
        id: "note-conversation-003",
        conversationId: "conversation-003",
        authorName: "Riley Morgan",
        content: "Do not request or record full payment card numbers. Review processor status only.",
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      {
        id: "note-conversation-007",
        conversationId: "conversation-007",
        authorName: "Alex Rivera",
        content: "Customer has been waiting since the original delivery estimate.",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(supportSettingsTable)
    .values({ id: 1, confidenceThreshold: 0.72 })
    .onConflictDoNothing();
}
