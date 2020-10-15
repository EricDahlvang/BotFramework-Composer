// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import React, { useCallback, useState } from 'react';
import { jsx, css } from '@emotion/core';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { FocusZone, FocusZoneDirection } from 'office-ui-fabric-react/lib/FocusZone';
import cloneDeep from 'lodash/cloneDeep';
import formatMessage from 'format-message';
import { DialogInfo, ITrigger, Diagnostic, DiagnosticSeverity } from '@bfc/shared';
import debounce from 'lodash/debounce';
import { useRecoilValue } from 'recoil';
import { ISearchBoxStyles } from 'office-ui-fabric-react/lib/SearchBox';

import {
  dispatcherState,
  currentProjectIdState,
  botProjectSpaceSelector,
  validateDialogSelectorFamily,
} from '../../recoilModel';
import { getFriendlyName } from '../../utils/dialogUtil';
import { triggerNotSupported } from '../../utils/dialogValidator';

import { TreeItem } from './treeItem';
import { ExpandableNode } from './ExpandableNode';

// -------------------- Styles -------------------- //

const searchBox: ISearchBoxStyles = {
  root: {
    borderBottom: '1px solid #edebe9',
    height: '45px',
    borderRadius: '0px',
  },
};

const root = css`
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  .ms-List-cell {
    min-height: 36px;
  }
`;

const icons = {
  TRIGGER: 'LightningBolt',
  DIALOG: 'Org',
  BOT: 'CubeShape',
  EXTERNAL_SKILL: 'Globe',
  FORM_DIALOG: '',
  FORM_FIELD: 'Variable2', // x in parentheses
  FORM_TRIGGER: 'TriggerAuto', // lightning bolt with gear
  FILTER: 'Filter',
};

const tree = css`
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  height: 100%;
  label: tree;
`;

// -------------------- ProjectTree -------------------- //

export type TreeLink = {
  displayName: string;
  isRoot: boolean;
  warningContent?: string;
  errorContent?: string;
  projectId: string;
  skillId: string | null;
  dialogName?: string;
  trigger?: number;
};

function isLinkEqual(link1: TreeLink | undefined, link2: TreeLink | undefined) {
  if (link1 === link2) return true;
  if (link1 == null) return false;
  if (link2 == null) return false;
  if (link1.projectId !== link2.projectId) return false;
  if (link1.skillId !== link2.skillId) return false;
  if (link1.dialogName !== link2.dialogName) return false;
  if (link1.trigger !== link2.trigger) return false;
  return true;
}

export type TreeMenuItem = {
  icon?: string;
  label: string; // leave this blank to place a separator
  action?: (link: TreeLink) => void;
};

function getTriggerName(trigger: ITrigger) {
  return trigger.displayName || getFriendlyName({ $kind: trigger.type });
}

function sortDialog(dialogs: DialogInfo[]) {
  const dialogsCopy = cloneDeep(dialogs);
  return dialogsCopy.sort((x, y) => {
    if (x.isRoot) {
      return -1;
    } else if (y.isRoot) {
      return 1;
    } else {
      return 0;
    }
  });
}

type BotInProject = {
  dialogs: DialogInfo[];
  projectId: string;
  name: string;
  isRemote: boolean;
};

type IProjectTreeProps = {
  onSelect?: (link: TreeLink) => void;
  showAll?: () => void;
  showTriggers?: boolean;
  showDialogs?: boolean;
  navLinks?: TreeLink[];
  onDeleteTrigger: (id: string, index: number) => void;
  onDeleteDialog: (id: string) => void;
};

export const ProjectTree: React.FC<IProjectTreeProps> = ({
  showAll = undefined,
  showTriggers = true,
  showDialogs = true,
  onDeleteDialog,
  onDeleteTrigger,
}) => {
  const { onboardingAddCoachMarkRef, selectTo, navTo } = useRecoilValue(dispatcherState);

  const [filter, setFilter] = useState('');
  const [selectedLink, setSelectedLink] = useState<TreeLink | undefined>();
  const delayedSetFilter = debounce((newValue) => setFilter(newValue), 1000);
  const addMainDialogRef = useCallback((mainDialog) => onboardingAddCoachMarkRef({ mainDialog }), []);
  const projectCollection = useRecoilValue<BotInProject[]>(botProjectSpaceSelector).map((bot) => ({
    ...bot,
    hasWarnings: false,
  }));
  const currentProjectId = useRecoilValue(currentProjectIdState);

  const notificationMap: { [projectId: string]: { [dialogId: string]: Diagnostic[] } } = {};
  for (const bot of projectCollection) {
    notificationMap[bot.projectId] = {};
    // this seems to be the only way to get these notifications
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dialogMessages = useRecoilValue(validateDialogSelectorFamily(bot.projectId));
    for (const message of dialogMessages) {
      const dialogId = message.id;
      notificationMap[bot.projectId][dialogId] = message.diagnostics;
    }
  }

  const dialogHasWarnings = (dialog: DialogInfo) => {
    notificationMap[currentProjectId][dialog.id].some((diag) => diag.severity === DiagnosticSeverity.Warning);
  };

  const botHasWarnings = (bot: BotInProject) => {
    return bot.dialogs.some(dialogHasWarnings);
  };

  const dialogHasErrors = (dialog: DialogInfo) => {
    notificationMap[currentProjectId][dialog.id].some((diag) => diag.severity === DiagnosticSeverity.Error);
  };

  const botHasErrors = (bot: BotInProject) => {
    return bot.dialogs.some(dialogHasErrors);
  };

  const handleOnSelect = (link: TreeLink) => {
    setSelectedLink(link);
    if (link.dialogName != null) {
      if (link.trigger != null) {
        selectTo(link.projectId, link.skillId, link.dialogName, `triggers[${link.trigger}]`);
      } else {
        navTo(link.projectId, link.skillId, link.dialogName);
      }
    }
  };

  const renderBotHeader = (bot: BotInProject) => {
    const link: TreeLink = {
      displayName: bot.name,
      projectId: currentProjectId,
      skillId: bot.projectId,
      isRoot: true,
      warningContent: botHasWarnings(bot) ? formatMessage('This bot has warnings') : undefined,
      errorContent: botHasErrors(bot) ? formatMessage('This bot has errors') : undefined,
    };

    return (
      <span
        key={bot.name}
        css={css`
          margin-top: -6px;
          width: 100%;
          label: bot-header;
        `}
        role="grid"
      >
        <TreeItem
          showProps
          icon={bot.isRemote ? icons.EXTERNAL_SKILL : icons.BOT}
          isSubItemActive={isLinkEqual(link, selectedLink)}
          link={link}
          menu={[{ label: formatMessage('Create/edit skill manifest'), action: () => {} }]}
          shiftOut={bot.isRemote ? 28 : 0}
        />
      </span>
    );
  };

  const renderDialogHeader = (skillId: string, dialog: DialogInfo) => {
    const warningContent = notificationMap[currentProjectId][dialog.id]
      .filter((diag) => diag.severity === DiagnosticSeverity.Warning)
      .map((diag) => diag.message)
      .join(',');
    const errorContent = notificationMap[currentProjectId][dialog.id]
      .filter((diag) => diag.severity === DiagnosticSeverity.Error)
      .map((diag) => diag.message)
      .join(',');

    const link: TreeLink = {
      dialogName: dialog.id,
      displayName: dialog.displayName,
      isRoot: dialog.isRoot,
      projectId: currentProjectId,
      skillId: null,
      errorContent,
      warningContent,
    };
    return (
      <span
        key={dialog.id}
        ref={dialog.isRoot ? addMainDialogRef : null}
        css={css`
          margin-top: -6px;
          width: 100%;
          label: dialog-header;
        `}
        role="grid"
      >
        <TreeItem
          showProps
          icon={icons.DIALOG}
          isSubItemActive={isLinkEqual(link, selectedLink)}
          link={link}
          menu={[
            {
              label: formatMessage('Remove this dialog'),
              icon: 'Delete',
              action: (link) => {
                onDeleteDialog(link.dialogName ?? '');
              },
            },
          ]}
          shiftOut={showTriggers ? 0 : 28}
          onSelect={handleOnSelect}
        />
      </span>
    );
  };

  function renderTrigger(projectId: string, item: any, dialog: DialogInfo): React.ReactNode {
    // NOTE: put the form-dialog detection here when it's ready
    const link: TreeLink = {
      displayName: item.displayName,
      warningContent: item.warningContent,
      errorContent: item.errorContent,
      trigger: item.index,
      dialogName: dialog.id,
      isRoot: false,
      projectId: currentProjectId,
      skillId: null,
    };

    return (
      <TreeItem
        key={`${item.id}_${item.index}`}
        dialogName={dialog.displayName}
        icon={icons.TRIGGER}
        isActive={isLinkEqual(link, selectedLink)}
        link={link}
        menu={[
          {
            label: formatMessage('Remove this trigger'),
            icon: 'Delete',
            action: (link) => {
              onDeleteTrigger(link.dialogName ?? '', link.trigger ?? 0);
            },
          },
        ]}
        shiftOut={48}
        onSelect={handleOnSelect}
      />
    );
  }

  const onFilter = (_e?: any, newValue?: string): void => {
    if (typeof newValue === 'string') {
      delayedSetFilter(newValue);
    }
  };

  function filterMatch(scope: string) {
    return scope.toLowerCase().includes(filter.toLowerCase());
  }

  function createDetailsTree(bot: BotInProject, startDepth: number) {
    const { projectId } = bot;
    const dialogs = sortDialog(bot.dialogs);

    const filteredDialogs =
      filter == null || filter.length === 0
        ? dialogs
        : dialogs.filter(
            (dialog) =>
              filterMatch(dialog.displayName) || dialog.triggers.some((trigger) => filterMatch(getTriggerName(trigger)))
          );

    if (showTriggers) {
      return filteredDialogs.map((dialog: DialogInfo) => {
        const triggerList = dialog.triggers
          .filter((tr) => filterMatch(dialog.displayName) || filterMatch(getTriggerName(tr)))
          .map((tr, index) => {
            const warningContent = triggerNotSupported(dialog, tr);
            const errorContent = notificationMap[projectId][dialog.id].some(
              (diag) => diag.severity === DiagnosticSeverity.Error && diag.path?.match(RegExp(`triggers\\[${index}\\]`))
            );
            return renderTrigger(
              projectId,
              { ...tr, index, displayName: getTriggerName(tr), warningContent, errorContent },
              dialog
            );
          });
        return (
          <ExpandableNode
            key={dialog.id}
            depth={startDepth}
            detailsRef={dialog.isRoot ? addMainDialogRef : undefined}
            summary={renderDialogHeader(projectId, dialog)}
          >
            <div>{triggerList}</div>
          </ExpandableNode>
        );
      });
    } else {
      return filteredDialogs.map((dialog: DialogInfo) => renderDialogHeader(projectId, dialog));
    }
  }

  function createBotSubtree(bot: BotInProject & { hasWarnings: boolean }) {
    if (showDialogs && !bot.isRemote) {
      return (
        <ExpandableNode key={bot.projectId} summary={renderBotHeader(bot)}>
          <div>{createDetailsTree(bot, 1)}</div>
        </ExpandableNode>
      );
    } else {
      return renderBotHeader(bot);
    }
  }

  const projectTree =
    projectCollection.length === 1
      ? createDetailsTree(projectCollection[0], 0)
      : projectCollection.map(createBotSubtree);

  return (
    <div
      aria-label={formatMessage('Navigation pane')}
      className="ProjectTree"
      css={root}
      data-testid="ProjectTree"
      role="region"
    >
      <FocusZone isCircularNavigation direction={FocusZoneDirection.vertical}>
        <SearchBox
          underlined
          ariaLabel={formatMessage('Type dialog name')}
          iconProps={{ iconName: icons.FILTER }}
          placeholder={formatMessage('Filter Dialog')}
          styles={searchBox}
          onChange={onFilter}
        />
        <div
          aria-label={formatMessage(
            `{
            dialogNum, plural,
                =0 {No bots}
                =1 {One bot}
              other {# bots}
            } have been found.
            {
              dialogNum, select,
                  0 {}
                other {Press down arrow key to navigate the search results}
            }`,
            { dialogNum: projectCollection.length }
          )}
          aria-live={'polite'}
        />
        <div css={tree}>
          {showAll != null ? (
            <TreeItem
              link={{ displayName: formatMessage('All'), skillId: null, projectId: currentProjectId, isRoot: true }}
              shiftOut={28}
              onSelect={showAll}
            />
          ) : null}
          {projectTree}
        </div>
      </FocusZone>
    </div>
  );
};
