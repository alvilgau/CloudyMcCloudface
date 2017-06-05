const analyzer = require('./main');


const positiveTweet = 'we love you and we love baby cats and we love puppies :-))';
const neutralTweet = 'trees are red and black';
const negativeTweet = 'we hate this and we hate that and the weather also sucks!';

test('analyze positive tweet', () => {
  const analyzedTweet = analyzer.analyzeTweet(positiveTweet);
  const score = analyzedTweet.score;
  expect(score).toBe(100);
});

test('analyze neutral tweet', () => {
  const analyzedTweet = analyzer.analyzeTweet(neutralTweet);
  const score = analyzedTweet.score;
  expect(score).toBe(0);
});

test('analyze negative tweet', () => {
  const analyzedTweet = analyzer.analyzeTweet(negativeTweet);
  const score = analyzedTweet.score;
  expect(score).toBe(-100);
});

const getValue = (values, name) => {
  return values.find(value => value.name === name).value;
};

test('analyze tweets', () => {
  const tweets = [positiveTweet, neutralTweet, negativeTweet];
  const analysis = analyzer.analyzeTweets(tweets);
  const values = analysis.values;
  console.log(analysis);
  const mean = getValue(values, 'Mean');
  const median = getValue(values, 'Median');
  const variance = Math.round(getValue(values, 'Variance'));
  const stdev = Math.round(getValue(values, 'Standard Deviation'));
  expect(mean).toBe(0);
  expect(median).toBe(0);
  expect(variance).toBe(6667);
  expect(stdev).toBe(82);
});