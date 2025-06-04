# Structured Task Format

Use the following structure for each task file (e.g., `Task-5.md`):

---

## 🧩 Task Title
Concise but descriptive title of the task (e.g., “Add Processing Fee Logic for Credit Payments”).

---

## 🎯 Objective
Describe **what** the task aims to accomplish and **why** it's needed. Mention any specific file(s), feature(s), or bugs related to the task.

Example:
> Implement logic to calculate and apply a processing fee for Credit payment types in `@20250506110523_create-rpc-for-bulk-payment-processing.sql`.

---

## 🔧 Steps to Implement
List clear, sequential, and specific steps that need to be taken. Do not include code — just describe the actions.

Example:
1. Open the file `@20250506110523_create-rpc-for-bulk-payment-processing.sql`.
2. Identify where payment type is evaluated.
3. Add logic to compute a processing fee only if the type is 'Credit'.
4. Ensure the fee is recorded in the correct output.
5. Maintain existing functionality for other payment types.

---

## 🧪 Validation Criteria
Define how the success of this task will be verified. Include test conditions or expected outcomes.

Example:
- Processing fee is correctly applied to all 'Credit' transactions.
- No impact on other payment types.
- All relevant test cases pass.

---

## 📝 Notes (Optional)
Include any special considerations, constraints, or context.

Example:
> This should be implemented using a pure SQL expression and should not modify the transaction handling logic.

---

