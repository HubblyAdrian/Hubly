import type { WebsiteState } from '../types';

interface WebsiteCanvasProps {
  websiteState: WebsiteState;
}

/**
 * Permanent home for website rendering.
 * Prompt 1 mounts the canvas; generation arrives in later prompts.
 * Do not replace this component later — extend it.
 */
export function WebsiteCanvas({ websiteState }: WebsiteCanvasProps) {
  const hasBrand = Boolean(websiteState.brand.name);
  const pageCount = websiteState.pages.length;

  return (
    <div className="hc-canvas" data-testid="website-canvas">
      <div className="hc-canvas-frame">
        <div className="hc-canvas-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="hc-canvas-stage">
          <div className="hc-canvas-empty">
            <p className="hc-canvas-kicker">WebsiteCanvas</p>
            <h2>Your site will appear here</h2>
            <p>
              Keep talking with Hubly. When creation begins, this canvas is where your website
              renders — permanently.
            </p>
            <dl className="hc-canvas-meta">
              <div>
                <dt>Brand</dt>
                <dd>{hasBrand ? websiteState.brand.name : 'Not set yet'}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{pageCount}</dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd>{websiteState.theme.mode}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
