//imports
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

//initialization and configs
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

//decralation
let onlineUsers = [];
let notifications = [];
//=============CONTROLLERS START =================================
const findUser = userID => {
  return onlineUsers.find(user => user.id === userID);
};
const updateUser = (userID, socketID) => {
  const userIndex = onlineUsers.findIndex(user => user.id === userID);
  const user = findUser(userID);
  if (!user) {
    console.log('could not find user to update');
  } else {
    onlineUsers.splice(userIndex, 1, { ...user, socketID });
  }
};
const deleteNotification = async id => {
  const index = notifications.findIndex(item => item.id === id);
  notifications.filter(item => item !== id);
  notifications.splice(index, 1);
};
const clearNotification = async () => {
  return [];
};
const updateNotification = async id => {
  const index = notifications.findIndex(item => item.id === id);
  const not = notifications.find(item => item.id === id);
  notifications.splice(index, 1, { ...not, read: true });
};
const findUserNotification = ({ type, senderID }) => {
  const item = notifications.find(notification => {
    if (notification.type?.type === type && notification.senderID === senderID)
      return true;
    return false;
  });
  return item;
};
const findPostNotification = ({ postID, type, senderID }) => {
  const item = notifications.find(notification => {
    if (
      notification.postID === postID &&
      notification.type?.type === type &&
      notification.senderID === senderID
    )
      return true;
    return false;
  });
  return item;
};
const addUser = async (userID, socketID) => {
  const user = findUser(userID);
  if (!user) {
    onlineUsers.push({ id: userID, socketID });
  } else {
    if (user.socketID !== socketID) {
      updateUser(userID, socketID);
      console.log('update user socket id');
    } else {
      console.log('user already exists');
    }
  }
};
const getUserNotifications = async userID => {
  return notifications.filter(
    notification => notification.receiverID === userID
  );
};
const addNotification = async ({
  postID,
  type: { target, type, ALLOW_DUPLICATE },
  messege,
  username,
  senderID,
  receiverID,
}) => {
  let notification = null;
  if (target === 'user') {
    notification = findUserNotification({ type, senderID });
  }
  if (!ALLOW_DUPLICATE) {
    notification = findPostNotification({ postID, type, senderID });
  } else {
    notification = null;
  }

  if (notification) {
    console.log('notification exists');
    return false;
  }
  if (senderID !== receiverID) {
    notifications.push({
      postID,
      type: { target, type },
      messege,
      senderID,
      username,
      receiverID,
      read: false,
      createdAt: new Date(),
      id: Date.now().toString(),
    });
    console.log('notification added', notifications);
    return true;
  } else {
    console.log(' this is your own');
    return false;
  }
};
const removeUser = async socketID => {
  onlineUsers = onlineUsers.filter(user => user.socketID !== socketID);
  console.log('a user removed', onlineUsers);
};

io.on('connection', socket => {
  socket.emit('SEND_DETAILS');

  socket.on('ADD_USER', userID => {
    addUser(userID, socket.id).then(() => {
      console.log('a user added', onlineUsers);
      io.emit('GET_ONLINE_USERS', onlineUsers);
      getUserNotifications(userID).then(notifications => {
        socket.emit('GET_NOTIFICATIONS', notifications);
      });
    });
  });

  socket.on('NOTIFICATIONS_USER_ID', userID => {
    getUserNotifications(userID).then(notifications => {
      socket.emit('GET_NOTIFICATIONS', notifications);
    });
  });

  socket.on(
    'ADD_NOTIFICATION',
    ({ postID, type, senderID, receiverID, messege, username }) => {
      addNotification({
        postID,
        type,
        senderID,
        username,
        receiverID,
        messege,
      }).then(results => {
        if (results) {
          //send notification if the user is online
          const user = findUser(receiverID);
          if (user) {
            getUserNotifications(receiverID).then(notifications => {
              io.to(user.socketID).emit('GET_NOTIFICATIONS', notifications);
            });
          }
        } else {
          console.log('user is offline');
        }
      });
    }
  );
  socket.on('READ_NOTIFICATION', id => {
    updateNotification(id).then(() => {
      socket.emit('GET_NOTIFICATIONS', notifications);
    });
  });
  socket.on('DELETE_NOTIFICATION', id => {
    deleteNotification(id).then(() => {
      socket.emit('GET_NOTIFICATIONS', notifications);
    });
  });
  socket.on('CLEAR_NOTIFICATION', () => {
    clearNotification().then(() => {
      socket.emit('GET_NOTIFICATIONS', newNots);
    });
  });
  socket.on('SEND_COMMENT_TO_OTHER_USER', ({ senderID, ...comment }) => {
    // const user = findUser(senderID);
    // if (user) {
    //   io.except(user?.socketID).emit('RECEIVE_COMMENT', comment);
    // } else {
    // }
    io.emit('RECEIVE_COMMENT', comment);
  });
  socket.on('SEND_MESSEGE', (messege, receiverID) => {
    const user = findUser(receiverID);
    //send the messege if the other user is online
    if (user) {
      io.to(user.socketID).emit('RECEIVE_MESSEGE', messege);
    } else {
      console.log('user is offline');
    }
  });
  socket?.on('AM_ONLINE', (userID, username) => {
    const user = findUser(userID);
    if (user) {
      io.except(user.socketID).emit('USER_COME_ONLINE', { userID, username });
    }
  });
  socket?.on('STOP_TYPING', (receiverID, roomID) => {
    const user = findUser(receiverID);
    //send the typing activity if the other user is online
    if (user) {
      io.to(user.socketID).emit('FRIEND_STOPED_TYPING', roomID);
    } else {
      console.log('user is offline');
    }
  });
  console.log('a user is connected');
  socket.on('disconnect', () => {
    removeUser(socket.id).then(() => {
      console.log('a user is disconnected');
      io.emit('GET_ONLINE_USERS', onlineUsers);
    });
  });
});

const port = process.env.PORT || 7000;
server.listen(port, () =>
  console.log(`socket server listening on port ${port}...waiting for requests`)
);
