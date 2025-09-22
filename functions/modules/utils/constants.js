/* utils/constants.js
   Central place for shared constants across modules
*/

module.exports = {
  Roles: {
    ADMIN: 'admin',
    EVENT_HOST: 'event-host',
    QUIZ_HOST: 'quiz-host',
    USER: 'user'
  },
  Reactions: ['like', 'love', 'clap', 'wow'],
  Visibility: ['public', 'college', 'friends'],
  Limits: {
    FEED_PAGE: 30,
    SEARCH_LIMIT: 50,
    COMMENTS_PAGE: 50,
    MESSAGES_PAGE: 100,
    BULK_CHUNK: 10
  }
};
