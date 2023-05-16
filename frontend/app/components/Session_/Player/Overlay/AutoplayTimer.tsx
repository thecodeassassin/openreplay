import React, { useEffect, useState } from 'react';
import cn from 'classnames';
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

interface IProps extends RouteComponentProps {
  nextId: number;
  siteId: string;
}

function AutoplayTimer({ nextId, siteId, history }: IProps) {
  let timer: NodeJS.Timer;
  const [cancelled, setCancelled] = useState(false);
  const [counter, setCounter] = useState(5);
  const { store } = React.useContext(PlayerContext);
  const { autoplay } = store.get();

  useEffect(() => {
    if (counter > 0) {
      timer = setTimeout(() => {
        setCounter(counter - 1);
      }, 1000);
    }

    if (counter === 0) {
      history.push(withSiteId(sessionRoute(nextId), siteId));
    }

    return () => clearTimeout(timer);
  }, [counter]);

  const cancel = () => {
    clearTimeout(timer);
    setCancelled(true);
  };

  if (cancelled) return null;

  return (
    <div className={cn(clsOv.overlay, stl.overlayBg)}>
      <div className='border p-5 shadow-lg bg-white rounded' style={{ width: '430px' }}>
        <SessionFeedback sessionId={'test'} />

        {!!nextId && autoplay && (
          <>
            <Divider />
            <div className='mb-5'>
              Autoplaying next session in <span className='font-medium'>{counter}</span> seconds
            </div>

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
    siteId: state.getIn(['site', 'siteId']),
    nextId: parseInt(state.getIn(['sessions', 'nextId']))
  }))(AutoplayTimer)
);
