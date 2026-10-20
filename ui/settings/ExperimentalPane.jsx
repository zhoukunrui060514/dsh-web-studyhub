import React from 'react';
import { ExperimentalSection } from '../ExperimentalSettings.jsx';
import JevSettings from '../JevSettings.jsx';
import { experimentalShown } from '../experimental-flag.js';
import { ui } from '../i18n.js';
import { Hint } from '../components/index.js';

/** 实验性功能: the one switch, and what it brings in once it is on: the material knowledge graph page, and Jev. */
export default function ExperimentalPane({ data, busy, act, call }) {
  return (
    <ExperimentalSection enabled={experimentalShown(data)} busy={busy} onChange={(enabled) => act('experimental.set', { enabled })}>
      <Hint size="xs" data-experimental="knowledge-graph">{ui('资料知识图谱（开发中）：打开后侧栏出现「知识图谱」，可从资料构建概念网络并对照原文提问。')}</Hint>
      <JevSettings busy={busy} call={call} />
    </ExperimentalSection>
  );
}
