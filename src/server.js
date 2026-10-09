import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`NaijaTaste AI listening on port ${PORT}`);
});
