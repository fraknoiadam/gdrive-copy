import type { FolderItem, SelectionState, LLMSelectionMap } from '../types/index.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class LLMService {
  private apiKey: string | null = null;
  private mockMode: boolean = true;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.mockMode = !apiKey || apiKey.trim() === '';
  }

  async selectFiles(folderStructure: FolderItem[], prompt: string): Promise<LLMSelectionMap> {
    if (this.mockMode) {
      return this._mockSelection(folderStructure);
    }

    try {
      const response = await this._callOpenAI(folderStructure, prompt);
      return this._parseSelection(response, folderStructure);
    } catch (error) {
      console.warn('LLM selection failed, falling back to mock:', error);
      return this._mockSelection(folderStructure);
    }
  }

  private _mockSelection(folderStructure: FolderItem[]): LLMSelectionMap {
    // Mock LLM that selects all files (equivalent to "Select All")
    const selections = new Map<string, SelectionState>();
    
    const selectAll = (items: FolderItem[]): void => {
      for (const item of items) {
        selections.set(item.id, 'all');
        if (item.children && item.children.length > 0) {
          selectAll(item.children);
        }
      }
    };
    
    selectAll(folderStructure);
    return selections;
  }

  private async _callOpenAI(folderStructure: FolderItem[], prompt: string): Promise<string> {
    const systemPrompt = `You are an AI assistant that helps users select files from a folder structure based on their requirements.

Given a folder structure and user requirements, return a JSON object where:
- Keys are file/folder IDs
- Values are selection types: "none", "all", "folder-only", or "partial"

Selection types:
- "none": Don't select this item
- "all": Select this item and all its contents (for folders)
- "folder-only": Select only the folder itself, not its contents
- "partial": Some children are selected (calculated automatically)

Folder structure format:
- id: unique identifier
- name: file/folder name  
- type: "file" or "folder"
- path: full path
- children: array of child items (for folders)

Return only valid JSON with no additional text.`;

    const userPrompt = `Folder structure:
${JSON.stringify(folderStructure, null, 2)}

User requirements: ${prompt}

Select appropriate files and folders based on these requirements.`;

    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ] as OpenAIMessage[],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    return data.choices[0].message.content;
  }

  private _parseSelection(response: string, folderStructure: FolderItem[]): LLMSelectionMap {
    try {
      const selections = JSON.parse(response) as Record<string, string>;
      const selectionMap = new Map<string, SelectionState>();
      
      // Validate that all IDs exist in the structure
      const allIds = new Set<string>();
      const collectIds = (items: FolderItem[]): void => {
        for (const item of items) {
          allIds.add(item.id);
          if (item.children) collectIds(item.children);
        }
      };
      collectIds(folderStructure);
      
      // Only include valid selections
      for (const [id, selection] of Object.entries(selections)) {
        if (allIds.has(id) && this._isValidSelectionState(selection)) {
          selectionMap.set(id, selection as SelectionState);
        }
      }
      
      // Fill in missing items as 'none'
      for (const id of allIds) {
        if (!selectionMap.has(id)) {
          selectionMap.set(id, 'none');
        }
      }
      
      return selectionMap;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      throw new Error('Invalid LLM response format');
    }
  }

  private _isValidSelectionState(selection: string): selection is SelectionState {
    return ['none', 'all', 'folder-only', 'partial'].includes(selection);
  }
}
