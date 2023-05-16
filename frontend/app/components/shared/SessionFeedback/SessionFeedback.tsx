import React from 'react';
import { ModalProps, Modal, Segmented, Checkbox, Divider } from 'antd';
import { Button, Icon } from 'UI';


const CheckboxGroup = Checkbox.Group;

interface Payload {
  interesting?: boolean;
  reason?: string;
  comment?: string;
}

const feedbackOptions = [
  {
    label: <div className='flex items-center'>
      <Icon name='hand-thumbs-up' size={20} />
      Helpful
    </div>,
    value: 'helpful'
  },
  {
    label: <div className='flex items-center'>
      <Icon name='hand-thumbs-down' size={20} />
      Not Helpful
    </div>,
    value: 'not-helpful'
  }
];

const checkBoxOptions = ['No issues found', 'No relevance', 'Other'];

interface Props {
  sessionId: string;
}


function SessionFeedback(props: Props) {
  const { sessionId, ...rest } = props;
  const [payload, setPayload] = React.useState<Payload>({
    interesting: true,
    reason: '',
    comment: ''
  });
  const [activeOption, setActiveOption] = React.useState<string>('not-helpful');


  const onChangeOption = (value: string) => {
    setPayload({
      ...payload,
      interesting: value === 'helpful'
    });
  };

  const onChange = (reason: any) => {
    setPayload({
      ...payload,
      reason: reason
    });
  };

  const onChangeComment = (e: any) => {
    setPayload({
      ...payload,
      comment: e.target.value
    });
  };

  return (
    <div>
      <div className='my-2 text-lg'>Did you find this session helpful?</div>
      <Segmented options={feedbackOptions} onChange={onChangeOption}
                 value={payload.interesting ? 'helpful' : 'not-helpful'} />

      {!payload.interesting && (
        <div className='my-2'>
          <div className='text-sm color-gray-medium'>Thank you for your feedback!</div>

          <div className='my-4'>
            <div className='text-lg'>Can you tell us more?</div>
            <div className='text-sm color-gray-medium'>Your feedback will help us to enhance the experience.</div>
          </div>

          <div className='flex items-center'>
            <CheckboxGroup options={checkBoxOptions} onChange={onChange} />
          </div>

          {payload.reason?.includes('Other') && (
            <div className='mt-4'>
              <textarea
                className='w-full p-2 rounded bg-white'
                placeholder='Enter your comment' onChange={onChangeComment}
                style={{
                  border: '1px solid #CCC'
                }}
              />
            </div>
          )}

          <Button className='mt-6' variant='outline'>Submit</Button>
        </div>
      )}
    </div>
  );
}

export default SessionFeedback;