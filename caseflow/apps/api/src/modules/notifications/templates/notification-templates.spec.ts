import { NOTIFICATION_TEMPLATES, renderNotification } from './notification-templates';

describe('notification templates', () => {
  it('renders every registered template without throwing', () => {
    for (const key of Object.keys(NOTIFICATION_TEMPLATES)) {
      const rendered = renderNotification(key, {
        organizationName: 'Global Migration',
        recipientName: 'Ivan',
        actionUrl: 'https://app.example.com/portal',
      });
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html).toContain('<!doctype html>');
    }
  });

  it('escapes HTML coming from user-controlled values', () => {
    const rendered = renderNotification('document.rejected', {
      organizationName: 'Global Migration',
      recipientName: 'Ivan',
      filename: 'passport.pdf',
      rejectionReason: '<script>alert(1)</script>',
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });

  it('fails loudly on an unknown template', () => {
    expect(() => renderNotification('does.not.exist', { organizationName: 'x', recipientName: 'y' })).toThrow();
  });
});
