document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('searchButton');
    const searchQuery = document.getElementById('searchQuery');
    const languageFilter = document.getElementById('languageFilter');
    const resultsDiv = document.getElementById('results');
    const resultsCount = document.getElementById('resultsCount');
    const loadingDiv = document.getElementById('loading');
    
    // Add event listeners
    searchButton.addEventListener('click', performSearch);
    searchQuery.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    function performSearch() {
        const query = searchQuery.value.trim();
        const langFilter = languageFilter.value;
        
        if (query === '') {
            alert('Please enter a search query');
            return;
        }
        
        // Show loading spinner
        loadingDiv.classList.remove('hidden');
        resultsDiv.innerHTML = '';
        resultsCount.textContent = '';
        
        // Construct the full query
        const fullQuery = langFilter ? `${query} ${langFilter}` : query;
        
        // Call the Sourcegraph API
        fetchCodeResults(fullQuery)
            .then(data => {
                loadingDiv.classList.add('hidden');
                displayResults(data, query);
            })
            .catch(error => {
                loadingDiv.classList.add('hidden');
                resultsDiv.innerHTML = `
                    <div class="error">
                        <p>Error fetching results: ${error.message}</p>
                        <p>Please check your query and try again.</p>
                    </div>
                `;
            });
    }
    
    async function fetchCodeResults(query) {
        // Note: In a real application, you would use your Sourcegraph instance URL
        // and appropriate authentication. This example uses the public Sourcegraph instance.
        const sourcegraphUrl = 'https://sourcegraph.com/.api/graphql';
        
        const graphqlQuery = {
            query: `
            query Search($query: String!) {
                search(query: $query, version: V2, patternType: literal) {
                    results {
                        resultCount
                        results {
                            __typename
                            ... on FileMatch {
                                repository {
                                    name
                                }
                                file {
                                    path
                                    url
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
                query: query
            }
        };
        
        const response = await fetch(sourcegraphUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Note: For authenticated requests, you would include an authorization header
                // 'Authorization': 'token YOUR_SOURCEGRAPH_TOKEN'
            },
            body: JSON.stringify(graphqlQuery)
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        return await response.json();
    }
    
    function displayResults(data, originalQuery) {
        if (!data.data || !data.data.search || !data.data.search.results) {
            resultsDiv.innerHTML = '<p>No results found or invalid response format.</p>';
            return;
        }
        
        const results = data.data.search.results;
        const count = results.resultCount;
        
        resultsCount.textContent = `Found ${count} result${count !== 1 ? 's' : ''}`;
        
        if (count === 0) {
            resultsDiv.innerHTML = '<p>No matching code found. Try a different search query.</p>';
            return;
        }
        
        const resultItems = results.results;
        resultItems.forEach(item => {
            if (item.__typename === 'FileMatch') {
                const repo = item.repository.name;
                const filePath = item.file.path;
                const fileUrl = item.file.url;
                
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                let content = `
                    <h3><a href="https://sourcegraph.com${fileUrl}" target="_blank">${filePath}</a></h3>
                    <div class="result-repo">Repository: ${repo}</div>
                    <div class="result-path">Path: ${filePath}</div>
                `;
                
                if (item.lineMatches && item.lineMatches.length > 0) {
                    content += '<div class="code">';
                    
                    item.lineMatches.forEach(lineMatch => {
                        const lineNumber = lineMatch.lineNumber;
                        let preview = lineMatch.preview;
                        
                        // Highlight the matching parts
                        if (lineMatch.offsetAndLengths && lineMatch.offsetAndLengths.length > 0) {
                            for (let i = lineMatch.offsetAndLengths.length - 1; i >= 0; i--) {
                                const [offset, length] = lineMatch.offsetAndLengths[i];
                                const before = preview.substring(0, offset);
                                const match = preview.substring(offset, offset + length);
                                const after = preview.substring(offset + length);
                                preview = before + `<span class="highlight">${match}</span>` + after;
                            }
                        }
                        
                        content += `<div>${lineNumber}: ${preview}</div>`;
                    });
                    
                    content += '</div>';
                }
                
                resultItem.innerHTML = content;
                resultsDiv.appendChild(resultItem);
            }
        });
    }
});
