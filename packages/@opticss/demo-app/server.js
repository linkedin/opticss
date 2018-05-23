const express = require('express');
const app = express();

app.use('/src', express.static('src'));
app.use('/dist', express.static('dist'));
app.use('/node_modules', express.static('./node_modules'));
app.use('/node_modules', express.static('../../../node_modules'));
app.use(express.static('static'));

app.listen(3000, function () {
  console.log('Opticss demo server listening on port 3000!')
});
