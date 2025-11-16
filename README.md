# TechMaju Mobile - AI Chat Application
This application complements the TechMaju platform instances installed with `techmaju_ai` by providing a template that can be white-labelled for customers to build a mobile app experience for their **AI Chat Agents**.

## Relevant API endpoints from TechMaju platform

**techmaju_ai.utils.document_utils.convert_file_for_chat**

Purpose: Convert a single uploaded File document into LLM-ready text (markdown/text/json).
Required params: file_name (File doctype name/ID in Frappe).
Optional params: export_format (markdown default; must be in {"markdown","text","json"}), options (JSON/dict fed directly to convert_document_to_text, typically layout/image toggles), delete_after_use (bool).
Behavior: Validates export format, normalizes options, asserts file exists and size is within MAX_FILE_SIZE_BYTES and batch constraints, enforces per-user hourly rate limit, then calls _convert_file_content (includes cache check keyed by file hash+options). Successful response: {source, source_label, status: "completed", export_format, content, from_cache}. Errors return frappe.ValidationError with messages like “Unsupported export format”, “File ... was not found”, or conversion-specific failure text.

**techmaju_ai.utils.document_utils.enqueue_file_conversion_batch**

Purpose: Kick off background conversion for up to 20 files with realtime status updates.
Params: file_names (list/JSON of File IDs), export_format, options, delete_after_use_map (dict mapping each file ID to boolean).
Behavior: Validates export format, normalizes inputs, ensures list length ≤ MAX_FILE_BATCH_COUNT and aggregate size ≤ MAX_BATCH_SIZE_BYTES, enforces rate limit proportional to number of files, prepares job state and pushes _process_file_batch_job onto long queue. Returns {job_id} immediately. Client must subscribe to tm_ai_doc_progress_<job_id> to receive state payloads (overall progress + per-source {status, content, error}) until a terminal status completed|failed|partial.

**techmaju_ai.utils.document_utils.convert_urls_for_chat**

Purpose: Fetch and convert up to 10 external URLs into text snippets the agent can reference.
Params: urls (list/stringified list), export_format, options.
Behavior: Normalizes URL list, ensures non-empty and ≤ MAX_URL_BATCH_COUNT, enforces rate limit, assigns a job_id, iterates each URL through _convert_url_content. Response: {results: [{source (original URL), source_label, status ("completed"/"failed"), export_format, content?, error?}], completed: <count>, failed: <count>, job_id}. Errors per URL (conversion, network, etc.) are captured in that entry.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_available_agents**

Purpose: Return every active TM AI agent the current user can access.
Inputs: none.
Behavior: Checks TM AI Chat Settings.enabled; returns [] if disabled. Fetches all active agents and filters by user roles against child table TM AI Chat Role. Output: [{name, agent_name, ai_model}].

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_chat_history_with_projects**

Purpose: Build the sidebar dataset (recent chats grouped by optional project).
Inputs: none.
Behavior: Queries TM AI Chat History for conversations tied to projects (SQL join for project title) and another query for unassigned chats (limit 10). Also fetches up to 5 TM AI Chat Project rows for the user. Response: {projects: [...], conversations_with_projects: [...], conversations_without_projects: [...]} where each conversation entry includes name, chat_agent, modified, status, display_name, project_name/project_title when applicable.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.rename_conversation**

Purpose: Rename a chat’s display title.
Params: chat_history_name, new_name.
Behavior: Loads TM AI Chat History, verifies ownership (doc.user == frappe.session.user), updates display_name, saves, and returns {"status": "success"}; otherwise throws “Access denied to this chat”.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.create_project**

Purpose: Create a user-scoped project container.
Params: project_title, optional description.
Behavior: Inserts TM AI Chat Project with user = frappe.session.user and returns the new project name (ID). Validation relies on Doctype rules (e.g., required title).

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.assign_to_project**

Purpose: Attach a chat history to an existing project.
Params: chat_history_name, project_name (can be blank to unassign).
Behavior: Verifies chat ownership; if project_name is provided, confirms that project belongs to the user. Sets chat_doc.project = project_name and saves. Response {"status":"success"}.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.archive_conversation**

Purpose: Mark a chat as archived (removes it from active lists).
Params: chat_history_name.
Behavior: Checks ownership, sets status = "Archived", saves, returns {"status":"success"}. Archiving also prevents further messaging (frontend enforces read-only state).

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_project_conversations**

Purpose: Load a project detail view with all active chats inside.
Params: project_name.
Behavior: Ensures the project belongs to the caller, fetches all non-archived TM AI Chat History rows referencing it, and returns {project: project_doc.as_dict(), conversations: [...]}.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.create_new_chat**

Purpose: Start a fresh conversation instance tied to a selected agent.
Params: agent_name (agent document name, not the label).
Behavior: Calls get_available_agents() to confirm access, inserts TM AI Chat History with messages="[]", status="Active", user=current. Returns the new chat name.

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_chat_conversation**

Purpose: Fetch full conversation history to resume a chat.
Params: chat_history_name, optional ignore_system (default True).
Behavior: Ensures user owns the chat, loads stored messages JSON (strips role == "system" entries when ignore_system), and returns {agent: chat_doc.chat_agent, messages, status}. Used to decide if the UI should switch to read-only mode (status != 'Active').

**techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.send_message**

Purpose: Core messaging endpoint that appends the user’s prompt and streams the agent’s reply.
Required params: chat_history_name, message (raw user text), realtime_event (channel string like tm_ai_chat_<user>_<chat_id>).
Optional params: doc_data (JSON array of objects {doctype, name} to pull entire documents as context plus schema metadata), text_context (JSON array [{label?, type?, content, metadata?}] representing converted files/URLs).
Key logic: Validates chat ownership and status; enforces per-agent max_chat_length by counting user messages only; runs AI Guard “Pre-LLM” policy which may block, mask, or rewrite the user input; performs usage-limit estimation via check_user_usage_limits. Constructs ai_messages:
Adds agent instructions and attached TM AI Context entries on the first user message.
Optionally appends doc_data dumps and derived DocType metadata (excluding structural fields) as system messages.
Adds user-provided text contexts (converted docs/URLs) with labels/source metadata.
If the agent’s use_vector_db is true and global Vector DB is enabled, executes search_knowledge_with_scope, optionally with conversation context for query rewriting, then appends the extracted context.
Appends the final user message (possibly masked by AI Guard).
Persists the updated messages list before streaming, then invokes stream(model_id, ai_messages, realtime_event) which emits realtime events ({delta_content, stream_status}) the client must listen for. After the model completes, runs AI Guard “Post-LLM”, possibly masking or blocking the assistant response, appends it to the conversation, updates TM AI Chat History.status to Completed if max length reached, logs usage via log_ai_usage, and returns a dict containing status, message, ai_guard results, and flags such as chat_completed, user_message_masked, assistant_message_masked, assistant_message_blocked.

**techmaju_ai.utils.ai_user_usage_utils.get_user_usage_info**

Purpose: Show daily usage progress in the sidebar.
Params: optional user (defaults to session user).
Behavior: If TM AI Usage Settings.track_user_usage is disabled, returns unlimited defaults. Otherwise ensures a TM AI User Usage doc exists, resets its daily_usage if >24h old, reads default_user_limit (0 means unlimited). Response: {daily_usage, total_usage, daily_limit, exceeded_limit, last_used}. Frontend computes percentage as usage.daily_usage / usage.daily_limit (cap at 100) and colors the progress bar based on thresholds ( <60 green, 60–79 warning, ≥80 danger ).