## UI/UX Improvement for Bizcard and Thank You Email Settings Pages

This issue tracks the remaining UI/UX improvements for the Bizcard Data Conversion Settings Page (`bizcardSettings.html`) and the Thank You Email Settings Page (`thankYouEmailSettings.html`), as well as the common Idempotency Control UI reflection.

### Bizcard Data Conversion Settings Page (`bizcardSettings.html`) - Remaining Tasks

#### Major Settings Area Structuring and Visual Improvement
- Implement a "Apply" button next to the "Coupon Code" input field to allow immediate validation after input.
  - Upon successful coupon application, display an explicit toast notification (e.g., "Coupon '[Coupon Code]' applied (-¥XXXX)").
  - Upon failed application, display specific error messages (e.g., "Invalid coupon code", "Expired") as an error display.

#### Save/Confirm Operation and Feedback
- The "Save settings and confirm request" button should be disabled (grayed out) until all required fields are entered and validation is successful.
- After processing is complete, display a success toast notification (e.g., "Bizcard data conversion settings saved and request confirmed!") and consider transitioning to an appropriate screen (e.g., Survey Details Modal or Survey List).

#### Others
- The memo field should be an independent section, allowing it to be expanded/collapsed as needed to focus on key settings.
- For all form inputs, thoroughly implement "Raised Label" style error display and real-time/submission validation in accordance with `design_guideline.md`.

### Thank You Email Settings Page (`thankYouEmailSettings.html`) - Remaining Tasks

#### Page Header and Survey Context
- Change the page title to "Thank You Email Settings for Survey '[Survey Name]'" and clearly display the name of the currently configured survey.
- Briefly display key information about the current survey (Survey Name, ID, Period) as read-only at the top of the page.

#### Send Requirement Setting and Dynamic Control of Related Items
- Change the "Thank You Email" send requirement from a dropdown to a **toggle switch (ON/OFF)**.
  - If the toggle is "Disabled (OFF)", all related input fields and sections below it (e.g., "Email Template Selection", "Email Subject/Body", "Recipient List", "Send Thank You Email Execution Button") should be **grayed out and hidden**.

#### Clarification of Sending Method and Conditional Display
- If the toggle is "Enabled (ON)", allow selection of "Automatic Send" or "Manual Send" via **radio buttons**.
- Next to each radio button, add an **explanatory text** (e.g., "Automatically sent after bizcard data conversion is complete.", "Can be manually sent from this screen after bizcard data conversion is complete.") to help users understand the difference.

#### Enhancement of Email Content Editing
- Below the "Email Template Selection" dropdown, provide a **preview area** for the selected template. The preview content should update whenever the template is switched.
- Below the "Email Subject" and "Email Body" input fields, or when the input field is in focus, display a **"Insert Variable" button**.
  - When the button is clicked, display a list of embeddable variables (e.g., `{Company Name}`, `{Name}`) and allow insertion at the cursor position by clicking.
- Below the email body input field, display a **real-time preview** with variables expanded, allowing users to visually confirm the actual email content.

#### Recipient List and Clear Guidance for Send Execution
- In the "Recipient List" section, clearly display the total number of eligible recipients (e.g., "Recipients: **X items**").
- If conditions (e.g., end of period, bizcard data conversion completion) are not met, display a message like "**Recipients will be displayed after the period ends and bizcard data conversion is complete.**" to guide the user to the next step.
- Clearly define the activation conditions for the "Send Thank You Email Execution" button:
  - "Thank You Email" is set to "Manual Send".
  - The survey's "Period" has ended.
  - Bizcard data conversion is complete (`bizcardCompletionCount` > 0, or survey status is `Upload Complete`).
  - There is at least one recipient.
- The button should only be enabled if all the above conditions are met. Otherwise, it should be **disabled (grayed out)**.
- The enabled button text should be "**Send Thank You Email**" and apply the primary button style.
- When clicked, display a confirmation dialog defined in `UI文言・メッセージ定義書` (e.g., "Are you sure you want to send thank you emails to XX recipients?").
- After sending is complete, display a success toast notification (e.g., "Thank you email sending started!").
- Within the page, provide an area to display the email's progress (e.g., "**Send Status: Sending / Sent / Failed**").

#### Save Settings Operation
- The button text for the "Save Settings" function should be "**Save Settings**".

### Idempotency Control UI Reflection (Common Instruction)

- Apply the following UI behavior to all buttons that involve data submission ("Create", "Save", "Update", "Send", etc.):
  - Immediately after clicking the button, **disable** the button.
  - Change the button's label to a text indicating processing (e.g., "Saving...", "Sending...") or display a **loading spinner** within the button.
  - Maintain this state until a response is received from the server.