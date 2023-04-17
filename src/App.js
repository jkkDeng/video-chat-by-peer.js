import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import copyTextToClipboard from './copy'
import styles from './styles.module.scss'
import { Alert, Button, Divider, Input, List, message, Row, Space, Spin, Tag } from "antd";

const { TextArea } = Input;
const App = () => {
  const [loading, setLoading] = useState(true);

  const [localId, setLocalId] = useState('');
  const [remoteId, setRemoteId] = useState('');

  const [messages, setMessages] = useState([]);
  const [customMsg, setCustomMsg] = useState('');

  const currentCall = useRef();
  const currentConnection = useRef();

  const peer = useRef()

  const localVideo = useRef();
  const remoteVideo = useRef();

  useEffect(() => {
    createPeer()

    return () => {
      endCall()
    }
  }, [])

  const endCall = () => {
    if (currentCall.current) {
      currentCall.current.close()
    }
  }

  const createPeer = () => {
    peer.current = new Peer();
    peer.current.on("open", (id) => {
      setLocalId(id)
      setLoading(false)
    });

    // 纯数据传输
    peer.current.on('connection', (connection) => {
      // 接受对方传来的数据
      connection.on('data', (data) => {
        setMessages((curtMessages) => [
          ...curtMessages,
          { id: curtMessages.length + 1, type: 'remote', data }
        ])
      })

      currentConnection.current = connection
    })

    // 媒体传输
    peer.current.on('call', async (call) => {
      if (window.confirm(`是否接受 ${call.peer}?`)) {
        // 获取本地流
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localVideo.current.srcObject = stream
        localVideo.current.play()

        // 响应
        call.answer(stream)

        // 监听视频流，并更新到 remoteVideo 上
        call.on('stream', (stream) => {
          remoteVideo.current.srcObject = stream;
          remoteVideo.current.play()
        })

        currentCall.current = call
      } else {
        call.close()
        alert('已关闭')
      }
    })
  }

  const callUser = async () => {
    // 获取本地视频流
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localVideo.current.srcObject = stream
    localVideo.current.play()

    // 数据传输
    const connection = peer.current.connect(remoteId);
    currentConnection.current = connection
    connection.on('open', () => {
      message.info('已连接')
    })

    // 多媒体传输
    const call = peer.current.call(remoteId, stream)
    call.on("stream", (stream) => {
      remoteVideo.current.srcObject = stream;
      remoteVideo.current.play()
    });
    call.on("error", (err) => {
      console.error(err);
    });
    call.on('close', () => {
      endCall()
    })

    currentCall.current = call
  }

  const sendMsg = () => {
    // 发送自定义内容
    if (!currentConnection.current) {
      message.warn('还未建立链接')
      return;
    }
    if (!customMsg) {
      return;
    }
    currentConnection.current.send(customMsg)
    setMessages((curtMessages) => [
      ...curtMessages,
      { id: curtMessages.length + 1, type: 'local', data: customMsg }
    ])
    setCustomMsg('');
  }
  const handleCopyClick = (copyText) => {
    if (!localId) {
      message.error('没有文本可复制')
    }
    copyTextToClipboard(copyText)
      .then(() => {
        message.success('复制成功')
      })
      .catch((err) => {
        console.log(err);
      });
  }
  const [myVideo, setMyVideo] = useState(false)
  const [uVideo, setUVideo] = useState(false)
  const triggerMyVideo = () => {
    setMyVideo(!myVideo)
  }
  const triggerUVideo = () => {
    setUVideo(!uVideo)
  }


  return (
    <div className={styles.container}>
      <Alert message='本通话不经过服务器完成两点之间的数据传输，请勿涉及任何隐私，且传输未必安全' closable />

      <Divider orientation='left'>本地ID</Divider>
      <Space direction="vertical" >
        <a href="#">{localId || <Spin spinning={loading} />}</a>
        <Button type="primary" onClick={() => handleCopyClick(localId)}>复制ID</Button>
      </Space>

      <Divider orientation='left'>输入对方ID</Divider>
      <Space direction="vertical" align="center" style={{ margin: 'auto', width: '100%' }}>
        <Input value={remoteId} onChange={e => setRemoteId(e.target.value)} type="text" placeholder="输入对方ID" />
        <Space>
          <Button type="primary" onClick={callUser}>视频通话</Button>
          <Button type="primary" danger onClick={endCall}>结束通话</Button>
        </Space>
      </Space>

      <Divider orientation='left'></Divider>
      <Space>
        <Button onClick={triggerMyVideo}>{myVideo ? '显示我的视频' : '关闭我的视频'}</Button>
        <Button onClick={triggerUVideo}>{uVideo ? '显示对方视频' : '关闭对方视频'}</Button>
      </Space>
      <Divider />

      <Row gutter={16} className={styles.live} >
        <Space direction="vertical" style={{ margin: 'auto', width: '100%' }}>
          <Row>
            {myVideo ?
              <></> : <>
                <Divider orientation='left'>本地摄像头</Divider>
                <video controls autoPlay ref={localVideo} muted />
              </>
            }
          </Row>
          <Row >
            {uVideo ?
              <></> : <>
                <Divider orientation='left'>对方摄像头</Divider>
                <video controls autoPlay ref={remoteVideo} />
              </>
            }
          </Row>
        </Space>

      </Row>
      <Divider />

      <Divider orientation='left'>发送消息</Divider>
      <div>
        <h2>消息列表</h2>
        <List
          itemLayout="horizontal"
          dataSource={messages}
          renderItem={msg => (
            <List.Item key={msg.id}>
              <div>
                <span>{msg.type === 'local' ? <Tag color="red">我</Tag> : <Tag color="green">对方</Tag>}</span>
                <span>{msg.data}</span>
              </div>
            </List.Item>
          )}
        />
        <Divider />

        <h2>自定义消息</h2>
        <TextArea
          placeholder="发送自定义内容"
          value={customMsg}
          onChange={e => setCustomMsg(e.target.value)}
          onEnter={sendMsg}
          rows={4}
        />
        <Button
          disabled={!customMsg}
          type="primary"
          onClick={sendMsg}
          style={{ marginTop: 16 }}>
          发送
        </Button>
      </div>
      <Divider />
      <Alert message='感谢项目：https://github.com/haixiangyan' closable />
      <Divider />

    </div>
  );
}

export default App;
