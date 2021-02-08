/*
* Copyright (c) 2018 - 2021 RescueTime 
* 
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
* 
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
* LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
* OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
* WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import * as vscode from 'vscode';
import { window } from 'vscode';

let rp = require('request-promise');

let myStatusBarItem: vscode.StatusBarItem;
let apiKey: String | undefined;
let hoursMinutes: String | undefined;
let focusPercentage: number | undefined;
let focusDots: String | undefined;
let tooltipText: String | undefined;
let extensionContext: vscode.ExtensionContext;

const REFRESH_TIME = 60 * 1000;
const RETRY_TIME = 30 * 1000;

export function activate(context: vscode.ExtensionContext) {
  console.log('RescueTime: is now active...');

  extensionContext = context;

  const myCommandId = 'rescuetime.openDashboard';

  myStatusBarItem = window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
  myStatusBarItem.command = myCommandId;
  context.subscriptions.push(myStatusBarItem);

  context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
    if (apiKey) {
      if (focusPercentage) {
        window.showInformationMessage(`You are currently ${focusPercentage}% focused on this.`);
      }
      window.showInformationMessage(`You've spent ${hoursMinutes} on Software Development today.`);
    } else {
      resetApiKey();
    }
  }));

  // check to see if API key is set, if not ask for it
  apiKey = context.globalState.get('rescuetime.apiKey');
  if (apiKey !== undefined && apiKey.trim() !== '') {
    // update status bar
    updateStatusBarItem();
  } else {
    resetApiKey();
  }
}

function updateStatusBarItem(): void {
  hoursMinutes = "-h -m";
  rp({
      method: 'GET',
      uri: 'https://www.rescuetime.com/api/data/taxonomy_presence_summary',
      qs: { taxonomy_name: 'overview', taxon_id: 10 },
      headers: { 'Authorization' : 'Bearer ' + apiKey },
      json: true
    }).then((response: any) => {
      let result = response;
      hoursMinutes = getDurationString(response.duration);
      focusPercentage = response.focus_percentage;
      focusDots = getFocusDots(focusPercentage);
      tooltipText = getTooltipText(focusPercentage);
      myStatusBarItem.text = `Dev Time $(clock): ${hoursMinutes} ${focusDots}`;
      myStatusBarItem.tooltip = `${tooltipText}`;
      myStatusBarItem.show();
      setTimeout(function(){ updateStatusBarItem(); }, REFRESH_TIME);
    }).catch((e: any) => {
      console.log(`RescueTime: Error: ${e}`);
      if (e && e.error && e.error.error && e.error.error.includes('key not')) {
        resetApiKey();
      }
      else {
        console.log('RescueTime: Retrying in 30 seconds..');
        setTimeout(function(){ updateStatusBarItem(); }, RETRY_TIME);
      }
    });
}

function getDurationString(duration: number): String {
  let date = new Date(0);
  date.setSeconds(duration);
  let timeString = date.toISOString().substr(11, 8);
  let hoursMinsSecs = timeString.split(':');
  if (parseInt(hoursMinsSecs[0]) > 0) {
    timeString = `${parseInt(hoursMinsSecs[0])}h ${parseInt(hoursMinsSecs[1])}m`;
  } else {
    timeString = `${parseInt(hoursMinsSecs[1])}m`;
  }
  return timeString;
}

function getFocusDots(percentage: number | undefined): String {
  if (!percentage) { return ''; }
  let solidDots = Math.round(percentage / 20.0);
  let result = ['○','○','○','○','○'];
  for (let i = 0; i < solidDots; i++) {
    result[i] = '◉';
  }
  return result.join('');
}

function getTooltipText(percentage: number | undefined): String {
  if (!percentage) { return ''; }
  let index = Math.round(percentage / 20.0);
  let focusLevels = ['Not Focused', 'Focus: Low', 'Focus: Mild', 'Focus: Moderate', 'Focus: High', 'Focus: Very High'];
  return focusLevels[index];
}

function resetApiKey() {
  extensionContext.globalState.update('rescuetime.apiKey', undefined);
  myStatusBarItem.text = `Dev Time $(clock): (click to enter API key)`;
  myStatusBarItem.tooltip = `Click to enter your RescueTime API key`;
  myStatusBarItem.show();

  window.showInputBox({ placeHolder: "Enter your RescueTime API Key" }).then(value => {
    if (!value) {
      apiKey = undefined;
      return;
    }
    apiKey = value.trim();
    extensionContext.globalState.update('rescuetime.apiKey', apiKey);
    updateStatusBarItem();
  });
}

export function deactivate() {}
