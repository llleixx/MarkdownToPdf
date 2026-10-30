# Math parsing regression

Dollar inline: $E=mc^2$.

Bracket inline: \(a^2+b^2=c^2\).

$$
\frac{1}{2}+\frac{1}{2}=1
$$

\[
\sum_{i=1}^{n}i=\frac{n(n+1)}{2}
\]

Prices: $5 and $10.

Escaped prices: \$5 and \$10.

Chinese adjacency: 能量$E=mc^2$成立。

Literal code: `$not_math$` and `\(not_math\)`.

```text
$$not_math$$
```

- List inline: $x+y$.

  $$
  x^2+y^2=z^2
  $$

> Quoted explanation before a multiline formula:
>
> $$
> a+b=c
> $$

Inline double dollars: $$x=1$$ end.

$$a=b$$ (1)
