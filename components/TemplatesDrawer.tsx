"use client";

import { useState } from "react";
import { DORK_TEMPLATES, type DorkCategory, type DorkTemplate } from "@/lib/dork-templates";

interface TemplatesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelect: (query: string, mode: "set" | "append") => void;
}

export default function TemplatesDrawer({ isOpen, onClose, onTemplateSelect }: TemplatesDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(DORK_TEMPLATES[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentCategory = DORK_TEMPLATES.find((cat) => cat.id === selectedCategory);

  // Filter templates based on search
  const filteredTemplates = searchQuery
    ? DORK_TEMPLATES.flatMap((cat) =>
        cat.templates
          .filter(
            (t) =>
              t.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              cat.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((t) => ({ category: cat, template: t }))
      )
    : currentCategory?.templates.map((t) => ({ category: currentCategory, template: t })) || [];

  const handleCopy = async (template: DorkTemplate) => {
    await navigator.clipboard.writeText(template.query);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (template: DorkTemplate, mode: "set" | "append") => {
    onTemplateSelect(template.query, mode);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#08090c] border-l border-gray-800 z-50 overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/50 flex items-center justify-between bg-[#0e0f14]">
          <div>
            <h2 className="text-lg font-bold text-gray-200 tracking-wide">DORK TEMPLATES</h2>
            <p className="text-[0.65rem] text-gray-600 mt-0.5">
              Pre-built search queries for common reconnaissance patterns
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-2 hover:bg-gray-800/50 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Educational Notice */}
        <div className="mx-6 mt-4 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex gap-3">
            <div className="text-yellow-500 shrink-0 text-lg">⚠️</div>
            <div>
              <h3 className="text-xs font-semibold text-yellow-400 mb-1 uppercase tracking-wider">
                Responsible Use Only
              </h3>
              <p className="text-[0.65rem] text-gray-500 leading-relaxed">
                These dork queries are for <strong className="text-yellow-500/80">educational purposes</strong>,{" "}
                <strong className="text-yellow-500/80">security research</strong>, and{" "}
                <strong className="text-yellow-500/80">authorized testing</strong> only. Always obtain proper
                authorization before testing systems you don't own. Unauthorized access is illegal.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="ds-input w-full pl-9 text-sm"
              spellCheck={false}
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Category Sidebar (hidden when searching) */}
          {!searchQuery && (
            <div className="w-48 border-r border-gray-800/50 bg-[#0a0b10] overflow-y-auto ds-scrollbar">
              {DORK_TEMPLATES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                    selectedCategory === category.id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-transparent text-gray-500 hover:bg-gray-800/30 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{category.icon}</span>
                    <span className="text-[0.7rem] font-semibold">{category.name}</span>
                  </div>
                  <div className="text-[0.6rem] text-gray-700 mt-0.5 ml-7">
                    {category.templates.length} templates
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto ds-scrollbar">
            {searchQuery && (
              <div className="px-6 py-3 bg-[#0a0b10] border-b border-gray-800/50 sticky top-0">
                <p className="text-[0.65rem] text-gray-600">
                  Found <span className="text-emerald-400 font-semibold">{filteredTemplates.length}</span>{" "}
                  template{filteredTemplates.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {filteredTemplates.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-700 text-3xl mb-2">🔍</div>
                <p className="text-sm text-gray-600">No templates found</p>
                <p className="text-[0.65rem] text-gray-700 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="px-6 py-4 space-y-3">
                {filteredTemplates.map(({ category, template }) => (
                  <div
                    key={`${category.id}-${template.id}`}
                    className="ds-card p-4 hover:border-gray-700 transition-all group"
                  >
                    {/* Category badge (shown in search mode) */}
                    {searchQuery && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs">{category.icon}</span>
                        <span className="text-[0.6rem] text-gray-600 uppercase tracking-wider">
                          {category.name}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-xs text-gray-400 mb-2">{template.description}</p>

                    {/* Query */}
                    <div className="bg-[#060709] border border-gray-800/50 rounded-md p-2.5 mb-3 font-mono text-[0.7rem] text-emerald-400/90 break-all">
                      {template.query}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUse(template, "set")}
                        className="flex-1 ds-btn-sm text-[0.65rem] justify-center hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        Use
                      </button>
                      <button
                        onClick={() => handleUse(template, "append")}
                        className="flex-1 ds-btn-sm text-[0.65rem] justify-center hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Append
                      </button>
                      <button
                        onClick={() => handleCopy(template)}
                        className="ds-btn-sm text-[0.65rem] hover:border-gray-600 hover:bg-gray-800/50"
                        title="Copy to clipboard"
                      >
                        {copiedId === template.id ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800/50 bg-[#0a0b10]">
          <div className="flex items-center justify-between text-[0.6rem] text-gray-700">
            <span>
              {DORK_TEMPLATES.reduce((acc, cat) => acc + cat.templates.length, 0)} total templates
            </span>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-wider"
            >
              Close [ESC]
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
