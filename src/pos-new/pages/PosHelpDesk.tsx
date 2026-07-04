import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Clipboard,
  ExternalLink,
  FileText,
  Flag,
  HelpCircle,
  Printer,
  Search
} from 'lucide-react';
import type { PosPageId, PosSession } from '../types';
import {
  HelpArticle,
  HelpFunctionLink,
  helpArticles,
  helpChapters,
  helpRelationshipGroupNames,
  helpRelationshipGroups,
  popularHelpArticleIds
} from '../services/helpDeskContent';
import {
  getHelpArticleById,
  getRelatedHelpArticles,
  searchHelpArticles
} from '../services/helpDeskSearchService';
import {
  getEffectivePageIdsForRole,
  sessionHasEffectivePermission
} from '../auth/effectivePermissionService';

interface PosHelpDeskProps {
  session: PosSession;
  onNavigate: (page: PosPageId) => void;
}

type IssueType = 'unclear instructions' | 'missing menu/function' | 'wrong information' | 'needs training' | 'other';
type HelpActivityType =
  | 'HELP_DESK_OPENED'
  | 'HELP_ARTICLE_VIEWED'
  | 'HELP_SEARCH_RUN'
  | 'HELP_FUNCTION_LINK_OPENED'
  | 'HELP_ARTICLE_PRINTED'
  | 'HELP_GUIDANCE_COPIED'
  | 'HELP_ARTICLE_MARKED_HELPFUL'
  | 'HELP_ISSUE_REPORTED';

interface HelpIssueDraft {
  issueType: IssueType;
  note: string;
}

const issueTypes: IssueType[] = ['unclear instructions', 'missing menu/function', 'wrong information', 'needs training', 'other'];
const activityKey = 'itred_pos_help_desk_activity_v1';
const issueKey = 'itred_pos_help_desk_issues_v1';

function recordHelpActivity(eventType: HelpActivityType, message: string, staffName: string, articleId?: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(activityKey);
    const rows = raw ? JSON.parse(raw) as unknown[] : [];
    const next = {
      id: `HELP-ACT-${Date.now()}`,
      eventType,
      message,
      articleId,
      staffName,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(activityKey, JSON.stringify([next, ...rows].slice(0, 120)));
  } catch {
    // Help activity is local/mock only.
  }
}

function buildArticleCopy(article: HelpArticle): string {
  return [
    article.title,
    article.summary,
    ...article.bodySections.map((section) => `${section.heading}\n${section.text}`),
    'Steps',
    ...article.steps.map((step, index) => `${index + 1}. ${step}`),
    'Best Practices',
    ...article.bestPractices.map((item) => `- ${item}`),
    'Warnings',
    ...article.warnings.map((item) => `- ${item}`)
  ].join('\n\n');
}

function saveHelpIssue(article: HelpArticle, draft: HelpIssueDraft, staffName: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(issueKey);
    const rows = raw ? JSON.parse(raw) as unknown[] : [];
    const next = {
      issueId: `HELP-ISS-${Date.now()}`,
      taskTitle: 'Help content review',
      articleId: article.articleId,
      articleTitle: article.title,
      issueType: draft.issueType,
      note: draft.note,
      submittedBy: staffName,
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(issueKey, JSON.stringify([next, ...rows].slice(0, 80)));
  } catch {
    // Local/mock issue persistence only.
  }
}

export default function PosHelpDesk({ session, onNavigate }: PosHelpDeskProps) {
  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [selectedArticleId, setSelectedArticleId] = useState(popularHelpArticleIds[0]);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueDraft, setIssueDraft] = useState<HelpIssueDraft>({ issueType: 'unclear instructions', note: '' });

  const selectedArticle = getHelpArticleById(selectedArticleId) || helpArticles[0];
  const allowedPages = useMemo(() => new Set(getEffectivePageIdsForRole(session.role)), [session.role]);

  const filteredArticles = useMemo(() => searchHelpArticles(helpArticles, query, {
    chapter: chapterFilter,
    relationshipGroup: groupFilter
  }), [chapterFilter, groupFilter, query]);

  const relatedArticles = useMemo(() => getRelatedHelpArticles(selectedArticle.articleId), [selectedArticle.articleId]);
  const popularArticles = popularHelpArticleIds.map((id) => getHelpArticleById(id)).filter((article): article is HelpArticle => Boolean(article));

  useEffect(() => {
    recordHelpActivity('HELP_DESK_OPENED', 'Help Desk Book opened.', session.staffName);
  }, [session.staffName]);

  const selectArticle = (article: HelpArticle) => {
    setSelectedArticleId(article.articleId);
    recordHelpActivity('HELP_ARTICLE_VIEWED', `Help article viewed: ${article.title}.`, session.staffName, article.articleId);
  };

  const runSearchActivity = () => {
    if (!query.trim()) return;
    recordHelpActivity('HELP_SEARCH_RUN', `Help search run: ${query.trim()}.`, session.staffName);
  };

  const openFunction = (fn: HelpFunctionLink) => {
    if (!sessionHasEffectivePermission(session, 'helpDesk.openFunctionLinks')) {
      setNotice('You may need permission from the Owner or Manager to open function links from Help Desk.');
      return;
    }
    if (!allowedPages.has(fn.targetPage)) {
      setNotice('You may need permission from the Owner or Manager to use this function.');
      return;
    }
    recordHelpActivity('HELP_FUNCTION_LINK_OPENED', `Function link opened: ${fn.label}.`, session.staffName, selectedArticle.articleId);
    if (fn.targetTab || fn.targetAction) {
      setNotice('Opened related page. Select the relevant tab/action to continue.');
      window.setTimeout(() => onNavigate(fn.targetPage), 350);
      return;
    }
    onNavigate(fn.targetPage);
  };

  const printArticle = () => {
    if (!sessionHasEffectivePermission(session, 'helpDesk.print')) {
      setNotice('You may need permission from the Owner or Manager to print help articles.');
      return;
    }
    const popup = window.open('', '_blank', 'width=900,height=720');
    if (popup) {
      popup.document.write(`<!doctype html><html><head><title>${selectedArticle.title}</title><style>body{font-family:Arial,sans-serif;color:#111827;background:#fff;margin:32px;line-height:1.45}h1{font-size:24px;margin:0 0 6px}h2{font-size:15px;margin-top:20px;color:#9a3412;text-transform:uppercase}p,li{font-size:12px}section{break-inside:avoid}small{color:#555}</style></head><body><article><small>${selectedArticle.chapter} / ${selectedArticle.relationshipGroup}</small><h1>${selectedArticle.title}</h1><p>${selectedArticle.summary}</p>${selectedArticle.bodySections.map((section) => `<section><h2>${section.heading}</h2><p>${section.text}</p></section>`).join('')}<h2>Steps</h2><ol>${selectedArticle.steps.map((step) => `<li>${step}</li>`).join('')}</ol><h2>Best Practices</h2><ul>${selectedArticle.bestPractices.map((item) => `<li>${item}</li>`).join('')}</ul><h2>Warnings</h2><ul>${selectedArticle.warnings.map((item) => `<li>${item}</li>`).join('')}</ul></article></body></html>`);
      popup.document.close();
      popup.print();
    }
    recordHelpActivity('HELP_ARTICLE_PRINTED', `Help article printed: ${selectedArticle.title}.`, session.staffName, selectedArticle.articleId);
  };

  const copyGuidance = async () => {
    if (!sessionHasEffectivePermission(session, 'helpDesk.copy')) {
      setNotice('You may need permission from the Owner or Manager to copy help guidance.');
      return;
    }
    const text = buildArticleCopy(selectedArticle);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Guidance copied to clipboard.');
    } catch {
      setCopyFallback(text);
      setNotice('Clipboard unavailable. Use the copyable text box.');
    }
    recordHelpActivity('HELP_GUIDANCE_COPIED', `Help guidance copied: ${selectedArticle.title}.`, session.staffName, selectedArticle.articleId);
  };

  const submitIssue = () => {
    if (!sessionHasEffectivePermission(session, 'helpDesk.reportIssue')) {
      setNotice('You may need permission from the Owner or Manager to report help issues.');
      return;
    }
    saveHelpIssue(selectedArticle, issueDraft, session.staffName);
    recordHelpActivity('HELP_ISSUE_REPORTED', `Help issue reported: ${selectedArticle.title}.`, session.staffName, selectedArticle.articleId);
    setIssueOpen(false);
    setIssueDraft({ issueType: 'unclear instructions', note: '' });
    setNotice('Help content review task saved locally.');
  };

  const markHelpful = () => {
    recordHelpActivity('HELP_ARTICLE_MARKED_HELPFUL', `Help article marked helpful: ${selectedArticle.title}.`, session.staffName, selectedArticle.articleId);
    setNotice('Marked helpful locally.');
  };

  return (
    <div className="help-desk-page industrial-font-sans">
      <header className="help-book-cover">
        <div>
          <p className="sci-pos-eyebrow">Help Desk</p>
          <h1>Help Desk Book</h1>
          <p>Searchable operating guide for iTred Commerce POS menus, workflows, and business controls.</p>
        </div>
        <BookOpen size={34} aria-hidden="true" />
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      <section className="help-search-card">
        <div className="help-search-bubble">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={runSearchActivity}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearchActivity();
            }}
            placeholder="Search help by menu, action, workflow, problem, customer, stock, cash, debtor, creditor, approval..."
          />
        </div>
        <div className="help-filter-row">
          {['All', ...helpChapters].map((chapter) => (
            <button key={chapter} type="button" className={`pos-page-submenu-item ${chapterFilter === chapter ? 'pos-page-submenu-item-active' : ''}`} onClick={() => setChapterFilter(chapter)}>
              {chapter}
            </button>
          ))}
        </div>
        <div className="help-filter-row">
          {['All', ...helpRelationshipGroupNames].map((group) => (
            <button key={group} type="button" className={`pos-page-submenu-item ${groupFilter === group ? 'pos-page-submenu-item-active' : ''}`} onClick={() => setGroupFilter(group)}>
              {group}
            </button>
          ))}
        </div>
      </section>

      <div className="help-book-layout">
        <aside className="help-book-panel help-book-chapters">
          <div className="help-panel-title">
            <p>Chapters</p>
            <h2>Relationship Groups</h2>
          </div>
          <button type="button" className={`help-chapter-button ${groupFilter === 'All' ? 'help-chapter-button--active' : ''}`} onClick={() => setGroupFilter('All')}>
            <span>All Articles</span>
            <small>{helpArticles.length}</small>
          </button>
          {helpRelationshipGroups.map((group) => (
            <button key={group.groupId} type="button" className={`help-chapter-button ${groupFilter === group.groupName ? 'help-chapter-button--active' : ''}`} onClick={() => setGroupFilter(group.groupName)}>
              <span>{group.groupName}</span>
              <small>{helpArticles.filter((article) => article.relationshipGroup === group.groupName).length}</small>
            </button>
          ))}

          <div className="help-panel-title help-panel-title--spaced">
            <p>Popular</p>
            <h2>Start Here</h2>
          </div>
          {popularArticles.map((article) => (
            <button key={article.articleId} type="button" className="help-topic-link" onClick={() => selectArticle(article)}>
              {article.title}
            </button>
          ))}
        </aside>

        <main className="help-book-panel help-article-list">
          <div className="help-panel-title">
            <p>{filteredArticles.length} result(s)</p>
            <h2>Articles</h2>
          </div>
          <div className="help-result-list">
            {filteredArticles.map((article) => (
              <button
                key={article.articleId}
                type="button"
                className={`help-result-card ${selectedArticle.articleId === article.articleId ? 'help-result-card--active' : ''}`}
                onClick={() => selectArticle(article)}
              >
                <span>{article.chapter} / {article.relationshipGroup}</span>
                <strong>{article.title}</strong>
                <p>{article.summary}</p>
                <div>{article.tags.slice(0, 5).map((tag) => <small key={tag}>{tag}</small>)}</div>
              </button>
            ))}
            {filteredArticles.length === 0 && (
              <div className="help-empty">
                No help article found. Try searching by menu name, action name, or workflow problem.
              </div>
            )}
          </div>

          <article id="help-article-print-area" className="help-article-reader">
            <div className="help-article-reader__header">
              <span>{selectedArticle.chapter} / {selectedArticle.relationshipGroup}</span>
              <h2>{selectedArticle.title}</h2>
              <p>{selectedArticle.summary}</p>
            </div>

            {selectedArticle.bodySections.map((section) => (
              <section key={section.heading}>
                <h3>{section.heading}</h3>
                <p>{section.text}</p>
              </section>
            ))}

            <section>
              <h3>Step-by-step usage</h3>
              <ol>{selectedArticle.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </section>

            <section>
              <h3>Best practice notes</h3>
              <ul>{selectedArticle.bestPractices.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            <section>
              <h3>Warnings and common mistakes</h3>
              <ul className="help-warning-list">{selectedArticle.warnings.map((item) => <li key={item}><AlertTriangle size={14} aria-hidden="true" /> {item}</li>)}</ul>
            </section>

            {selectedArticle.buildModeNote && (
              <section className="help-build-note">
                <h3>Workflow note</h3>
                <p>{selectedArticle.buildModeNote}</p>
              </section>
            )}
          </article>
        </main>

        <aside className="help-book-panel help-related-panel">
          <div className="help-panel-title">
            <p>Actions</p>
            <h2>Article Tools</h2>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => selectedArticle.relatedFunctions[0] && openFunction(selectedArticle.relatedFunctions[0])}>
            <ExternalLink size={16} aria-hidden="true" /> Open Function
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={printArticle}>
            <Printer size={16} aria-hidden="true" /> Print Help Article
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void copyGuidance()}>
            <Clipboard size={16} aria-hidden="true" /> Copy Guidance
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={markHelpful}>
            <CheckCircle size={16} aria-hidden="true" /> Mark Helpful
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setIssueOpen(true)}>
            <Flag size={16} aria-hidden="true" /> Report Help Issue
          </button>

          <div className="help-panel-title help-panel-title--spaced">
            <p>Links</p>
            <h2>Related Functions</h2>
          </div>
          <div className="help-function-list">
            {selectedArticle.relatedFunctions.map((fn) => {
              const allowed = allowedPages.has(fn.targetPage);
              return (
                <button key={`${fn.label}-${fn.targetPage}-${fn.targetTab || ''}`} type="button" onClick={() => openFunction(fn)} className={!allowed ? 'help-function-link help-function-link--restricted' : 'help-function-link'}>
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>{fn.label}</span>
                  <small>{allowed ? fn.description : 'You may need permission from the Owner or Manager to use this function.'}</small>
                </button>
              );
            })}
          </div>

          <div className="help-panel-title help-panel-title--spaced">
            <p>Related</p>
            <h2>Topics</h2>
          </div>
          <div className="help-related-topic-list">
            {relatedArticles.map((article) => (
              <button key={article.articleId} type="button" onClick={() => selectArticle(article)}>
                <FileText size={14} aria-hidden="true" />
                <span>{article.title}</span>
              </button>
            ))}
          </div>

          <div className="help-glossary">
            <div className="help-panel-title">
              <p>Glossary</p>
              <h2>Quick Terms</h2>
            </div>
            <dl>
              <div><dt>COGS Reserve</dt><dd>Replacement stock seed protected from sales money.</dd></div>
              <div><dt>Decision File</dt><dd>Approval record with reason, risk, audit, and related actions.</dd></div>
              <div><dt>Workflow</dt><dd>Business actions, approvals, and supporting audit records.</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      {copyFallback && (
        <div className="pos-modal-backdrop">
          <div className="pos-modal pos-modal--wide" role="dialog" aria-modal="true">
            <div className="pos-modal__header">
              <div><p className="sci-pos-eyebrow">Copy Guidance</p><h2>Clipboard Fallback</h2></div>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setCopyFallback(null)}>Close</button>
            </div>
            <textarea className="help-copy-fallback" value={copyFallback} readOnly />
          </div>
        </div>
      )}

      {issueOpen && (
        <div className="pos-modal-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true">
            <div className="pos-modal__header">
              <div><p className="sci-pos-eyebrow">Local Help Review</p><h2>Report Help Issue</h2></div>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setIssueOpen(false)}>Close</button>
            </div>
            <div className="pos-modal__body help-issue-form">
              <label>
                Article
                <input value={selectedArticle.title} readOnly />
              </label>
              <label>
                Issue Type
                <select value={issueDraft.issueType} onChange={(event) => setIssueDraft({ ...issueDraft, issueType: event.target.value as IssueType })}>
                  {issueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Note
                <textarea rows={5} value={issueDraft.note} onChange={(event) => setIssueDraft({ ...issueDraft, note: event.target.value })} placeholder="Explain what should be clearer or added." />
              </label>
              <label>
                Submitted By
                <input value={session.staffName} readOnly />
              </label>
            </div>
            <div className="pos-modal__footer">
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setIssueOpen(false)}>Cancel</button>
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submitIssue}>
                <HelpCircle size={16} aria-hidden="true" /> Save Local Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
