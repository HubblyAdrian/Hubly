# Hubly V1 Finish Line

Architecture is complete and frozen.

Business Memory · Business DNA · Runtime · Planner · Orchestrator · Connectors · Constitution · Customer Runtime · Website Runtime · Business Health — **frozen**.

Do not introduce new AI systems, product categories, or architectural abstractions.

From this point forward we are **finishing Hubly V1**.

---

## Objective

Every sprint removes the biggest blocker preventing a real business from running entirely on Hubly.

No feature work outside the current milestone.

---

## Current milestone: First Customer

Do not move to Business Running until this is completely finished.

**Definition of Done** is not “booking exists.”

It is:

1. A customer successfully **hires** a business  
2. The business successfully **completes** the job  
3. The business successfully **gets paid**  
4. The business successfully **asks for a review**  
5. CRM updates automatically  
6. Business Health updates automatically  
7. Everything happens without manual intervention  

### Revenue loop (one transaction)

Visitor → Lead → Quote (if needed) → Booking → Payment → Calendar → Job → Completion → Review request → Review → CRM → Business Health → Owner Feed → Repeat customer  

Nothing should exist outside this loop.

### Close every gap before moving on

| Area | Required |
|---|---|
| Payments | Success · Failed · Cancelled · Refund · Receipt · Deposit · Webhook reliability |
| Calendar | Conflicts · Reschedule · Cancel · Sync · Time zones |
| Messaging | Confirmation · Reminder · Owner notify · Completion · Review request |
| CRM | Every interaction enriches automatically — no manual entry |
| Owner Feed | Every important event appears |
| Business Health | Every completed action updates Health — never manual recalculation |

### Stop adding

AI Marketing · Autonomous Growth · Living Marketplace · Advanced Coach · Business Intelligence · additional AI layers  

Those belong after V1.

---

## Next: Business Running

Owner operates an entire day without leaving Hubly  
(leads → reply → book → pay → jobs → complete → reviews → Daily → Feed).

---

## V1 release criteria

| Milestone | Status |
|---|---|
| Business Created | Complete |
| Business Launched | Complete (foundations) |
| First Customer | In progress — customer pays · owner notified · job · calendar · complete · review · CRM · Health |
| Business Running | After First Customer |

When every checkbox is complete: **stop building. Ship beta.**

### Beta goal

Not 1,000 businesses. **10 businesses.** Watch them. Collect friction. Let customers write V2.

---

## North Star

**Revenue generated through Hubly-powered businesses.**

If a feature does not help a business **Launch · Earn money · Operate · Grow**, it does not belong in V1.

Source of truth for checkboxes: [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)
