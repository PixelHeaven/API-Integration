document.addEventListener('DOMContentLoaded', function() {
    // Application state
    const appState = {
        currentPage: 1,
        resultsPerPage: 20,
        totalResults: 0,
        searchHistory: [],
        savedSearches: [],
        settings: {
            theme: 'light',
            codeFontSize: 14,
            apiEndpoint: 'https://sourcegraph.com/.api/graphql',
            apiToken: '',
            defaultCaseSensitive: false,
            defaultIncludeContext: true,
            defaultResultsLimit: 50
        }
    };

    // DOM Elements
    const elements = {
        // Theme toggle
        themeToggle: document.getElementById('themeToggle'),
        
        // Search elements
        searchQuery: document.getElementById('searchQuery'),
        searchButton: document.getElementById('searchButton'),
        clearSearch: document.getElementById('clearSearch'),
        advancedOptionsToggle: document.getElementById('advancedOptionsToggle'),
        advancedOptions: document.getElementById('advancedOptions'),
        saveSearchBtn: document.getElementById('saveSearchBtn'),
        searchTags: document.getElementById('searchTags'),
        
        // Filter elements
        languageFilter: document.getElementById('languageFilter'),
        repoFilter: document.getElementById('repoFilter'),
        patternType: document.getElementById('patternType'),
        resultsLimit: document.getElementById('resultsLimit'),
        caseSensitive: document.getElementById('caseSensitive'),
        includeContext: document.getElementById('includeContext'),
        
        // Results elements
        resultsContainer: document.getElementById('resultsContainer'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('emptyState'),
        results: document.getElementById('results'),
        resultsStats: document.getElementById('resultsStats'),
        pagination: document.getElementById('pagination'),
        sortOrder: document.getElementById('sortOrder'),
        listView: document.getElementById('listView'),
        gridView: document.getElementById('gridView'),
        
        // Sidebar elements
        sidebarToggle: document.getElementById('sidebar-toggle'),
        searchHistory: document.getElementById('searchHistory'),
        savedSearches: document.getElementById('savedSearches'),
        
        // Modals
        settingsBtn: document.getElementById('settingsBtn'),
        settingsModal: document.getElementById('settingsModal'),
        keyboardShortcutsModal: document.getElementById('keyboardShortcutsModal'),
        codePreviewModal: document.getElementById('codePreviewModal'),
        
        // Settings elements
        apiEndpoint: document.getElementById('apiEndpoint'),
        apiToken: document.getElementById('apiToken'),
        defaultCaseSensitive: document.getElementById('defaultCaseSensitive'),
        defaultIncludeContext: document.getElementById('defaultIncludeContext'),
        defaultResultsLimit: document.getElementById('defaultResultsLimit'),
        codeFontSize: document.getElementById('codeFontSize'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        saveSettings: document.getElementById('saveSettings'),
        
        // Code preview elements
        codePreview: document.getElementById('codePreview'),
        previewFileName: document.getElementById('previewFileName'),
        previewRepoPath: document.getElementById('previewRepoPath'),
        openInSourcegraph: document.getElementById('openInSourcegraph'),
        copyFilePathBtn: document.getElementById('copyFilePathBtn'),
        
        // Toast container
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize the application
    initApp();
    
    /*
     * Core Functions
     */
    
    function initApp() {
        loadSettings();
        applyTheme();
        setupEventListeners();
        updateUIFromSettings();
        loadSearchHistory();
        loadSavedSearches();
    }
    
    function setupEventListeners() {
        // Theme toggle
        elements.themeToggle.addEventListener('click', toggleTheme);
        
        // Search functionality
        elements.searchButton.addEventListener('click', performSearch);
        elements.searchQuery.addEventListener('keypress', e => {
            if (e.key === 'Enter') performSearch();
        });
        elements.clearSearch.addEventListener('click', clearSearch);
        elements.advancedOptionsToggle.addEventListener('click', toggleAdvancedOptions);
        elements.saveSearchBtn.addEventListener('click', saveCurrentSearch);
        
        // Results view
        elements.listView.addEventListener('click', () => switchView('list'));
        elements.gridView.addEventListener('click', () => switchView('grid'));
        elements.sortOrder.addEventListener('change', sortResults);
        
        // Sidebar toggle
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
        
        // Settings modal
        elements.settingsBtn.addEventListener('click', () => showModal(elements.settingsModal));
        elements.saveSettings.addEventListener('click', saveSettings);
        
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                setTheme(theme);
                updateThemeButtons(theme);
            });
        });
        
        // Font size slider
        elements.codeFontSize.addEventListener('input', updateFontSize);
        
        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', e => {
                const modal = e.target.closest('.modal');
                hideModal(modal);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Copy file path
        elements.copyFilePathBtn.addEventListener('click', copyFilePath);
    }
    
    function performSearch() {
        const query = elements.searchQuery.value.trim();
        if (!query) {
            showToast('error', 'Error', 'Please enter a search query');
            return;
        }
        
        const searchParams = getSearchParams();
        
        // Show loading state
        elements.emptyState.classList.add('hidden');
        elements.results.innerHTML = '';
        elements.loading.classList.remove('hidden');
        elements.resultsStats.textContent = 'Searching...';
        
        // Add to search history
        addToSearchHistory(searchParams);
        
        // Update search tags
        updateSearchTags(searchParams);
        
        // Make API request
        fetchSearchResults(searchParams)
            .then(data => {
                elements.loading.classList.add('hidden');
                displayResults(data, searchParams);
            })
            .catch(error => {
                elements.loading.classList.add('hidden');
                elements.results.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>An error occurred</h3>
                        <p>${error.message}</p>
                    </div>
                `;
                elements.resultsStats.textContent = 'Error occurred';
                showToast('error', 'Search Error', error.message);
            });
    }
    
    function getSearchParams() {
        return {
            query: elements.searchQuery.value.trim(),
            language: elements.languageFilter.value,
            repository: elements.repoFilter.value.trim(),
            patternType: elements.patternType.value,
            caseSensitive: elements.caseSensitive.checked,
            includeContext: elements.includeContext.checked,
            limit: parseInt(elements.resultsLimit.value),
            page: appState.currentPage,
            timestamp: new Date().toISOString()
        };
    }
    
    async function fetchSearchResults(params) {
        const apiEndpoint = appState.settings.apiEndpoint;
        
        // Build the full query
        let fullQuery = params.query;
        
        if (params.language) {
            fullQuery += ` ${params.language}`;
        }
        
        if (params.repository) {
            fullQuery += ` repo:${params.repository}`;
        }
        
        if (params.caseSensitive) {
            fullQuery += ' case:yes';
        }
        
        const graphqlQuery = {
            query: `
            query Search($query: String!, $patternType: SearchPatternType!, $limit: Int!) {
                search(query: $query, version: V2, patternType: $patternType, first: $limit) {
                    results {
                        limitHit
                        matchCount
                        approximateResultCount
                        missing {
                            name
                        }
                        cloning {
                            name
                        }
                        timedout {
                            name
                        }
                        results {
                            __typename
                            ... on FileMatch {
                                repository {
                                    name
                                    url
                                }
                                file {
                                    path
                                    url
                                    content
                                    commit {
                                        oid
                                        author {
                                            date
                                        }
                                    }
                                }
                                lineMatches {
                                    lineNumber
                                    offsetAndLengths
                                    preview
                                }
                            }
                        }
                    }
                }
            }`,
            variables: {
                query: fullQuery,
                patternType: params.patternType.toUpperCase(),
                limit: params.limit
            }
        };
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add API token if available
        if (appState.settings.apiToken) {
            headers['Authorization'] = `token ${appState.settings.apiToken}`;
        }
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(graphqlQuery)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.errors && data.errors.length > 0) {
            throw new Error(`GraphQL Error: ${data.errors[0].message}`);
        }
        
        return data;
    }
    
    function displayResults(data, searchParams) {
        if (!data.data || !data.data.search || !data.data.search.results) {
            elements.results.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results found</h3>
                    <p>Try adjusting your search query or filters</p>
                </div>
            `;
            elements.resultsStats.textContent = 'No results found';
            return;
        }
        
        const searchResults = data.data.search.results;
        const matchCount = searchResults.matchCount || 0;
        const approximateCount = searchResults.approximateResultCount || 0;
        const isLimitHit = searchResults.limitHit || false;
        
        // Update application state
        appState.totalResults = approximateCount;
        
        // Update results stats
        let statsText = `Found ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`;
        if (isLimitHit) {
            statsText += ' (limit hit)';
        }
        elements.resultsStats.textContent = statsText;
        
        // Check if we have results
        const results = searchResults.results;
        if (!results || results.length === 0) {
            elements.results.innerHTML = `
                <div class="empty-state">
                    ...
