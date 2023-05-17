import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Button, Link } from 'UI';
import { session as sessionRoute, withSiteId } from 'App/routes';
import stl from './AutoplayTimer.module.css';
import clsOv from './overlay.module.css';
import AutoplayToggle from 'Shared/AutoplayToggle';
import SessionFeedback from 'Shared/SessionFeedback';
import { Divider } from 'antd';
import { PlayerContext } from 'Components/Session/playerContext';
import cn from 'classnames';


interface CountdownProps {
  initialCounter: number;
  paused: boolean;
  onComplete: () => void;
}

const Countdown: React.FC<CountdownProps> = ({ initialCounter, paused, onComplete }) => {
  const [counter, setCounter] = useState(initialCounter);

  useEffect(() => {
    let timer: NodeJS.Timer;

    if (!paused && counter > 0) {
      timer = setTimeout(() => {
        setCounter(counter - 1);
      }, 1000);
    } else if (!paused && counter === 0) {
      onComplete();
    }

    return () => clearTimeout(timer);
  }, [counter, onComplete, paused]);

  return (
    <div className='mb-5'>
      {paused ? (
        <span className='font-medium'>Autoplaying paused for this moment.</span>
      ) : (
        <>
          Autoplaying next session in <span className='font-medium'>{counter}</span> seconds
        </>
      )}
    </div>
  );
};

interface IProps extends RouteComponentProps {
  nextId: number;
  siteId: string;
  sessionId: string;
}

function AutoplayTimer({ sessionId, nextId, siteId, history }: IProps) {
  const [cancelled, setCancelled] = useState(false);
  const [paused, setPaused] = useState(false);
  const { store } = React.useContext(PlayerContext);
  const { autoplay } = store.get();

  const handleCountdownComplete = () => {
    history.push(withSiteId(sessionRoute(nextId), siteId));
  };

  const cancel = () => {
    setCancelled(true);
  };

  if (cancelled) return null;

  return (
    <div className={cn(clsOv.overlay, stl.overlayBg)}>
      <div className='border p-5 shadow-lg bg-white rounded' style={{ width: '430px' }}>
        <SessionFeedback sessionId={sessionId} onChanged={() => setPaused(true)} />

        {!!nextId && autoplay && (
          <>
            <Divider />

            <Countdown initialCounter={5} onComplete={handleCountdownComplete} paused={paused} />

            <div className='flex items-center justify-between'>
              <div className='mr-10'>
                <AutoplayToggle />
              </div>
              <div className='flex items-center'>
                <Button variant='text-primary' onClick={cancel}>
                  Cancel
                </Button>
                <div className='px-2' />
                <Link to={sessionRoute(nextId)} disabled={!nextId}>
                  <Button variant='outline'>Play Now</Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default withRouter(
  connect((state: any) => ({
    sessionId: state.getIn(['sessions', 'current']).sessionId,
    siteId: state.getIn(['site', 'siteId']),
    nextId: parseInt(state.getIn(['sessions', 'nextId']))
  }))(AutoplayTimer)
);
