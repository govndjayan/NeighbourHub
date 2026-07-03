const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  try {
    await expo.sendPushNotificationsAsync([{
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    }]);
  } catch (error) {
    console.log('Push notification error:', error.message);
  }
};

module.exports = sendPushNotification;