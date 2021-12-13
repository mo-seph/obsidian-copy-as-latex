

// Pull items out of a bibliography
const bibItemPattern = /(^|\n)\s*(@\w+{[^@]*)(?=(\n\s*@|$))/sg
// Get the key from a bibliography item
const bibKeyPattern = /^[\s\S]*@\w+{([^,]*)/s

export class BibtexConverter {
    /*
     * Returns a dictionary of all the bibtex entries in the file
     * by key
     */
    parseBibtex(text:string) : Record<string,string> {
        const items = [...text.matchAll(bibItemPattern)].map(i => i[2])
        const kvps = items.map(i => [i.match(bibKeyPattern)[1], i ] )
        const result = Object.fromEntries(kvps)
        return result
    }

}