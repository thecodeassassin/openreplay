session_summary_base_prompt_long = """"Afterwards we received the following events:\n{event_list_json}\nContinue the description of what the user was doing based on the events"""
# Maybe set previous summary description as context instead of prompt begining
session_summary_base_prompt = """{event_list_json}\nDescribe the user behaviour using the list of events shown previously, make a list to describe user behaviour."""

# LLM Request formula:
## {role: user/system/assistant, content: message}
