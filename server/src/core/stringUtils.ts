export class StringUtils
{
    public static jsonStringifyCircular(obj: Object): string
    {
        let cache: unknown[] | null = [];
        const stringified = JSON.stringify(obj, (_key, value: string) => {
            if (value !== null && typeof value === 'object') {
                if (cache?.includes(value)) {
                    // Circular reference found, discard key
                    return '';
                }
                // Store value in our collection
                cache?.push(value);
            }
            return value;
        }, 4);
        cache = null;
        return stringified;
    }
}
