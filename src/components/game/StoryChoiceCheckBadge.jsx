import React from 'react';
import { createChoiceCheckBadgeElement } from '../../../base44/shared/story/choiceCheckDisplay';

export default function StoryChoiceCheckBadge({ choice, riskStyle }) {
  return createChoiceCheckBadgeElement(React.createElement, choice, {
    className: 'px-1.5 py-0.5 rounded-full font-fantasy',
    'data-story-choice-check-badge': 'true',
    style: {
      background: riskStyle.badge.bg,
      color: riskStyle.badge.color,
      border: `1px solid ${riskStyle.badge.border}`,
      fontSize: '0.6rem',
    },
  });
}