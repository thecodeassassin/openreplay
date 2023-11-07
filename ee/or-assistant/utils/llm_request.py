import json
import requests
from time import sleep
from typing import List
from utils.events_split import process_llm_response
from utils.params import LLM_ENDPOINT, LLM_API_KEY, LLM_TEMPERATURE
from utils.base_prompt import session_summary_base_prompt, \
        session_summary_base_prompt_long
import tiktoken
import openai
# import anyscale


def call_endpoint(url, **params):
    if 'method' in params.keys():
        method = params.pop('method')
    else:
        method = 'GET'

    if method == 'GET':
        return json.loads(requests.get(url, data=json.dumps(params['data']), headers=params['headers']).content)
    elif method == 'POST':
        return json.loads(requests.post(url, data=json.dumps(params['data']), headers=params['headers']).content)
    elif method == 'PUT':
        return json.loads(requests.put(url, data=json.dumps(params['data']), headers=params['headers']).content)
    else:
        raise ValueError('Method not implemented')


#def get_events(_try=0, **params):
#    """
#    Events have these possible keys:
#        for iOS:
#            events
#                TAP
#                INPUT
#                VIEW
#                SWIPE
#            crashes
#            userEvents
#                customEvents
#            issues
#                 click_rage
#                 dead_click
#                 bad_request
#                 missing_resource
#                 memory
#                 cpu
#                 custom
#                 mouse_thrashing
#        for others:
#            events
#                click
#                input
#                location
#            stackEvents
#                errors != js_exception
#            errors
#                js_exception
#            userEvents
#                customEvents
#            resources
#            issues
#                click_rage
#                dead_click
#                bad_request
#                missing_resource
#                memory
#                cpu
#                custom
#                mouse_thrashing
#
#    # look at api/chalice/core/sessions_replay:get_events function.
#    """
#    try:
#        events = json.loads(call_endpoint(chalice_endpoint, **params))
#        return events
#    except json.decoder.JSONDecodeError as e:
#        raise e
#    except requests.RequestException as e:
#        if _try > 3:
#            sleep(0.5 * _try)
#            get_events(_try = _try + 1, **params)
#        else:
#            raise e


class Completion:

    def __init__(self, url):
        self.url = url
        self.temperature = LLM_TEMPERATURE
        self.llm_api_key = LLM_API_KEY
        self.response_keys = ['id', 'object', 'created', 'model', 'choices', 'usage']
        self.max_tokens = 16384
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.message_history = list()
        # 'id': {model}-{id}
        # 'object': method (text-completion)
        # 'created': timestamp
        # 'model': model
        # 'choices': list of the following
        #       message
        #           role: Assistant
        #           content: response
        #       index
        #       finish_reason
        # 'usage'a

    def update_message_history(self, message: str, role: str = 'user', raw: bool = False):
        if raw:
            self.message_history.append({
                'role': role,
                'content': message
                })
        elif self.message_history:
            formated = session_summary_base_prompt_long.format(
                event_list_json=message
                )
            self.message_history.append({
                'role': role,
                'content': formated
            })
        else:
            formated = session_summary_base_prompt.format(
                    event_list_json=message
                    )
            self.message_history.append({
                'role': role,
                'content': formated
            })


    def process_large_input(self, long_prompt: List[dict], filter_response=True, context=''):
        # TODO: Fix enumeration in the response when doing the next request
        splited_prompt = self.split_long_event_list(long_prompt)
        phrase = ''
        valid = False
        for sub_prompt in splited_prompt:
            for word in self.send_stream_request(str(sub_prompt), filter_response=filter_response, context=context):
                if '•' in word or '*' in word:
                    valid = True
                    phrase += word
                elif '\n' in word and valid:
                    valid = False
                    phrase += word
                    yield phrase
                    phrase = ''
                elif valid:
                    phrase += word
                else:
                    continue

                # yield word
        print('[INFO]', self.message_history)

    def send_stream_request(self, message: str, filter_response: bool = True, context: str = ''):
        # splited_prompt = self.split_long_event_list(long_prompt)
        self.update_message_history(message, raw=True)
        response = openai.ChatCompletion.create(
                api_base = LLM_ENDPOINT,
                api_key= LLM_API_KEY,
                model = "codellama/CodeLlama-34b-Instruct-hf",
                messages = [{'role': 'system', 'content': context if context else "You are an AI assistant that summarize json events into user behaviour. You must only answer about the user behaviour during the session using bullet points."}] + self.message_history[-2:] if len(self.message_history) > 1 else self.message_history,
                stream = True
                )
        self.message_history.pop()
        words = ''
        for tok in response: 
            delta = tok.choices[0].delta
            if not delta: # End token 
                if filter_response:
                    self.message_history.append({'role': 'assistant',
                                                 'content': process_llm_response(words)})
                else:
                                                self.message_history.append({'role': 'assistant',
                                                                             'content': words})
                break
            elif 'content' in delta:
                words += delta['content']
                yield delta['content'] 
            else: 
                continue

    # def update_message_history(self, inp):
    #    self.message_history.append({
    #        'role': 'user',
    #        'content': inp
    #        })


    def completion(self, prompt: str, previous_assistant_message: str = '', context: str = ''):
        data = {"model": "codellama/CodeLlama-34b-Instruct-hf", "messages": [{"role": "system", "content": context if context else "You are an assistant capable of summarize json events into a list of user behaviour. Your answers are enumerations or continuation of enumerations."}] + [{"role": "assistant", "content": previous_assistant_message}] if previous_assistant_message else [] + [{"role": "user", "content": prompt }], "temperature": self.temperature}
        params = {"data": data, "method": "POST", "headers": {"Authorization": f"Bearer {self.llm_api_key}"}}
        return call_endpoint(self.url, **params)

    def split_long_event_list(self, long_event_list):
        n_tokens = len(self.tokenizer.encode(str(long_event_list)))
        splited = list()
        number_of_splits = 4 * n_tokens // self.max_tokens
        if number_of_splits == 0:
            return long_event_list
        else:
            split_size = len(long_event_list) // number_of_splits
            for i in range(number_of_splits):
                splited.append(long_event_list[split_size * i: min(split_size * (i+1), len(long_event_list))])
            return splited

    def completion_long(self, long_event_list):
        n_tokens = len(self.tokenizer.encode(str(long_event_list)))
        splited = list()
        number_of_splits = 4 * n_tokens // self.max_tokens
        if number_of_splits == 0:
            return self.completion(str(long_event_list)+"\n Describe given the events shown previously, the user behaviour in the website")
        else:
            split_size = len(long_event_list) // number_of_splits
            for i in range(number_of_splits):
                splited.append(long_event_list[split_size * i: min(split_size * (i+1), len(long_event_list))])
            responses = list()
            for splt in splited:
                responses.append(
                        self.completion(
                            str(splt)+"\n Describe given the events shown previously, the user behaviour in the website"
                            )
                        )
        return responses
