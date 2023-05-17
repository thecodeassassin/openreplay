import React, { useState } from 'react';
import { Segmented, Checkbox } from 'antd';
import { Icon, Button } from 'UI';
import { Feedback, Payload } from 'Shared/SessionFeedback/index';
import { toast } from 'react-toastify';
import { sessionService } from 'App/services';

const CheckboxGroup = Checkbox.Group;

const feedbackOptions = [
  {
    label: (
      <div className='flex items-center'>
        <Icon name='hand-thumbs-up' size={20} />
        Helpful
      </div>
    ),
    value: 'helpful'
  },
  {
    label: (
      <div className='flex items-center'>
        <Icon name='hand-thumbs-down' size={20} />
        Not Helpful
      </div>
    ),
    value: 'not-helpful'
  }
];

const checkBoxOptions = ['No issues found', 'No relevance', 'Other'];

interface Props {
  sessionId: string;
  onChanged: () => void;
}

function SessionFeedback(props: Props) {
  const { sessionId, onChanged } = props;
  const [validPayload, setValidPayload] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [payload, setPayload] = useState<Payload>({
    interesting: true,
    reason: '',
    comment: ''
  });

  React.useEffect(() => {
    validatePayload();
  }, [payload]);

  const validatePayload = () => {
    const isValid = !!payload.reason;
    setValidPayload(isValid);
  };

  const onChangeOption = (value: string) => {
    setPayload({
      ...payload,
      interesting: value === 'helpful'
    });

    if (value !== 'helpful') {
      onChanged();
    }
  };

  const onChange = (reason: string[]) => {
    setPayload({
      ...payload,
      reason: reason.join(', ')
    });
  };

  const onChangeComment = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPayload({
      ...payload,
      comment: e.target.value
    });
  };

  const submitHandle = async () => {
    setLoading(true);
    const data: Feedback = {
      sessionId: sessionId,
      payload: payload
    };

    try {
      await sessionService.sendFeedback(data);
      toast.success('Thank you for your feedback!');
    } catch (error) {
      toast.error('Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className='my-2 text-lg'>Did you find this session helpful?</div>
      <Segmented
        options={feedbackOptions}
        onChange={onChangeOption}
        value={payload.interesting ? 'helpful' : 'not-helpful'}
      />

      {!payload.interesting && (
        <div className='my-2'>
          <div className='text-sm color-gray-medium'>Thank you for your feedback!</div>

          <div className='my-4'>
            <div className='text-lg'>Can you tell us more?</div>
            <div className='text-sm color-gray-medium'>Your feedback will help us enhance the experience.</div>
          </div>

          <div className='flex items-center'>
            <CheckboxGroup options={checkBoxOptions} onChange={onChange} />
          </div>

          {payload.reason?.includes('Other') && (
            <div className='mt-4'>
              <textarea
                className='w-full p-2 rounded bg-white'
                placeholder='Enter your comment'
                onChange={onChangeComment}
                style={{
                  border: '1px solid #CCC'
                }}
              />
            </div>
          )}

          <Button loading={loading} className='mt-6' variant='outline' onClick={submitHandle}
                  disabled={!validPayload}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

export default SessionFeedback;
