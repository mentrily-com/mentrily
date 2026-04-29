import { LanguageConfig } from './types';

export const JavascriptConfig: LanguageConfig = {
    id: 'javascript',
    label: 'JavaScript',
    header: `/**
 * @param {number[]} nums
 * @return {number}
 */
const solution = (nums) => {`,
    initialBody: `  const result = nums.reduce((a, b) => a + b, 0);
  return result;`,
    footer: `};

console.log(solution([1, 2, 3]));`,
    extension: async () => {
        const { javascript } = await import('@codemirror/lang-javascript');
        return javascript();
    },
};

export const PythonConfig: LanguageConfig = {
    id: 'python',
    label: 'Python 3',
    header: `import sys

def solver(data):
    # Process inputs`,
    initialBody: `    result = sum(data)
    return result`,
    footer: `
if __name__ == "__main__":
    print(solver([1, 2, 3]))`,
    extension: async () => {
        const { python } = await import('@codemirror/lang-python');
        return python();
    },
};

export const CppConfig: LanguageConfig = {
    id: 'cpp',
    label: 'C++',
    header: `#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

int solve(vector<int>& nums) {`,
    initialBody: `    int sum = 0;
    for (int n : nums) sum += n;
    return sum;`,
    footer: `}

int main() {
    vector<int> nums = {1, 2, 3, 4};
    cout << solve(nums) << endl;
    return 0;
}`,
    extension: async () => {
        const { cpp } = await import('@codemirror/lang-cpp');
        return cpp();
    },
};

export const JAVA_BOILERPLATE: LanguageConfig = {
    id: 'java',
    label: 'Java 17',
    header: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.solve(new int[]{1, 2, 3}));
    }
}

class Solution {`,
    initialBody: `    public int solve(int[] nums) {
        int sum = 0;
        for (int n : nums) sum += n;
        return sum;
    }`,
    footer: `}`,
    extension: async () => {
        const { java } = await import('@codemirror/lang-java');
        return java();
    },
};

export const SUPPORTED_LANGUAGES = [CppConfig, JavascriptConfig, PythonConfig, JAVA_BOILERPLATE];
