const { sanitizeSlug } = require(__dirname + '/index.js');

test('test sanitizer', () => {
    expect(sanitizeSlug('españa rules')).toBe('espana-rules');
});
