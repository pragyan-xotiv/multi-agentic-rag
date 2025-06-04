# 🛠️ Implementation Task: [Task Name] for [Feature Name]

---

## 📌 Task Context
Describe this task’s role in the overall feature or product. Clarify *why* this task exists and what part of the system it affects.

> Example: This task handles the logic for applying a processing fee to Credit payments in the bulk payment SQL procedure, ensuring parity with the UI-level fee display.

---

## 🧱 Pattern References
(Include links or file paths to existing reference implementations that should guide this task)

- **Component Pattern**: [Path or link]
- **API Pattern**: [Path or link]
- **State Pattern**: [Path or link]
- **Other References**: [Any relevant logic/patterns]

---

## 🎯 Task Scope
Describe exactly *what needs to be done* — focus on functionality, not implementation.

1. [First key objective of this task]
2. [Second specific change or goal]
3. [Third, etc.]

---

## 📝 Requirements
These are the **technical or business rules** that must be satisfied.

- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

---

## 🔗 Dependencies
Mention any external/internal modules, APIs, or teams this task depends on.

- **[Dependency Name]** – [Short description of dependency purpose]
- **[Database table/module]** – [Reason for dependency]

---

## 🧪 Validation Criteria
Define how this task’s success will be measured.

- [Condition 1] — e.g., "Credit payments show the correct processing fee"
- [Condition 2] — e.g., "All existing unit tests continue to pass"
- [Condition 3] — e.g., "No change in behavior for non-credit transactions"

---

## 📂 Implementation Details
### File Location:
> [Path to the file that should be modified or created]

### Expected Interface (if applicable):
```typescript
// Example TypeScript interface or function signature
function calculateProcessingFee(amount: number, type: 'Credit' | 'Debit'): number;
